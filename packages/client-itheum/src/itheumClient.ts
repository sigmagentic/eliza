import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
    base58,
    DasApiAsset,
    MplBubblegumProvider,
} from "@elizaos/plugin-mpl-bubblegum";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { IDataNFT, IMusicPlaylist, TensorResponse } from "./interfaces";
import {
    TwitterManager,
    validateTwitterConfig,
    TwitterConfig,
} from "@elizaos/client-twitter";
import { ClientBase } from "./base.ts";
import {
    twitterPostHoldingsTemplate,
    twitterPostTensorBuysTemplate,
    twitterPostTensorListingsTemplate,
} from "./templates.ts";
import { getRelativeTime, sleep } from "./utils.ts";

export class ItheumClient {
    private runtime: IAgentRuntime;
    private client: ClientBase;
    private mplBubblegumProvider: MplBubblegumProvider;
    private dataMarshalApi: string;
    private chainId: string;
    private keypair: Keypair;
    private twitterManager: TwitterManager;

    constructor(
        runtime: IAgentRuntime,
        mplBubblegumProvider: MplBubblegumProvider,
        chainId: string,
        keypair: Keypair
    ) {
        elizaLogger.log("📱 Constructing new ItheumClient...");
        this.client = new ClientBase(runtime);
        this.mplBubblegumProvider = mplBubblegumProvider;
        this.dataMarshalApi = this.getDataMarshalApi(chainId);
        this.chainId = chainId;
        this.keypair = keypair;
        this.runtime = runtime;
    }

    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Itheum client...");
        try {
            const twitterConfig: TwitterConfig = await validateTwitterConfig(
                this.runtime
            );

            this.twitterManager = new TwitterManager(
                this.client.runtime,
                twitterConfig
            );
            await this.twitterManager.client.init();
            await this.initializeClient();
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Itheum client:", error);
            throw error;
        }
    }

    public async initializeClient(): Promise<void> {
        elizaLogger.log("🚀 Initializing Itheum client...");

        const handleFetchLoop = async () => {
            const nftsDetails = await this.fetchDataFromNfts();

            for (const nftDetails of nftsDetails) {
                const additionalParams = [
                    { key: "hashtags", value: ["#DataNFT", "#ItheumDataNft"] },
                    {
                        key: "albumTitle",
                        value: nftDetails.musicPlaylist.data_stream.name,
                    },
                    {
                        key: "artist",
                        value: nftDetails.musicPlaylist.data_stream.creator,
                    },
                    {
                        key: "artwork",
                        value: nftDetails.metadata.properties.files[0].uri,
                    },
                    {
                        key: "audioPreview",
                        value: nftDetails.metadata.properties.files[1].uri,
                    },
                    {
                        key: "totalTracks",
                        value: nftDetails.musicPlaylist.data_stream
                            .marshalManifest.totalItems,
                    },
                ];

                await this.twitterManager.post.generateNewTweet(
                    twitterPostHoldingsTemplate,
                    additionalParams
                );
            }

            setTimeout(
                handleFetchLoop,
                Number(
                    this.client.runtime.getSetting("ITHEUM_FETCH_INTERVAL") ||
                        60
                ) * 1000 // default to 60 seconds
            );
        };
        handleFetchLoop();

        const handleTensorLoops = async () => {
            try {
                const { listings, buys } = await this.checkTensorActivity();

                const processListings = async () => {
                    try {
                        for (const listing of listings) {
                            const additionalParams = [
                                {
                                    key: "assetId",
                                    value: listing.onchainId,
                                },
                                {
                                    key: "timeline",
                                    value: getRelativeTime(listing.txAt),
                                },
                                {
                                    key: "url",
                                    value: `https://www.tensor.trade/item/${listing.onchainId}`,
                                },
                            ];

                            await sleep(20 + Math.random() * 100);
                            await this.twitterManager.post.generateNewTweet(
                                twitterPostTensorListingsTemplate,
                                additionalParams
                            );
                        }
                    } catch (error) {
                        console.error("Error processing listings:", error);
                    }
                };

                const processBuys = async () => {
                    try {
                        for (const buy of buys) {
                            const additionalParams = [
                                {
                                    key: "assetId",
                                    value: buy.onchainId,
                                },
                                {
                                    key: "timeline",
                                    value: getRelativeTime(buy.txAt),
                                },
                                {
                                    key: "url",
                                    value: `https://www.tensor.trade/item/${buy.onchainId}`,
                                },
                            ];

                            await sleep(20 + Math.random() * 180);
                            await this.twitterManager.post.generateNewTweet(
                                twitterPostTensorBuysTemplate,
                                additionalParams
                            );
                        }
                    } catch (error) {
                        console.error("Error processing buys:", error);
                    }
                };

                await Promise.all([processListings(), processBuys()]);
            } catch (error) {
                console.error("Error in tensor loops:", error);
            } finally {
                setTimeout(
                    handleTensorLoops,
                    Number(
                        this.client.runtime.getSetting(
                            "ITHEUM_TENSOR_INTERVAL"
                        ) || 30
                    ) * 1000
                );
            }
        };

        handleTensorLoops();
    }

    public async fetchDataFromNfts(): Promise<
        { id: string; metadata: IDataNFT; musicPlaylist: IMusicPlaylist }[]
    > {
        elizaLogger.log("🚀 Fetching data from NFT...");
        const newNfts = await this.checkNewNfts();

        const nonce = await this.preaccess();

        const nonceEncoded = new TextEncoder().encode(nonce);

        const signature = nacl.sign.detached(
            nonceEncoded,
            this.keypair.secretKey
        );

        const encodedSignature = bs58.encode(signature);

        const newNftsDetails: {
            id: string;
            metadata: IDataNFT;
            musicPlaylist: IMusicPlaylist;
        }[] = [];

        for (const nft of newNfts) {
            const metadataResponse = await fetch(nft.content.json_uri);

            const metadata: IDataNFT = await metadataResponse.json();

            const viewDataArgs = {
                headers: {
                    "dmf-custom-sol-collection-id": nft.grouping[0].group_value,
                },
                fwdHeaderKeys: ["dmf-custom-sol-collection-id"],
            };

            const response = await this.viewData(
                nft.id,
                nonce,
                encodedSignature,
                new PublicKey(this.mplBubblegumProvider.getKeypairPublicKey()),
                viewDataArgs.fwdHeaderKeys,
                viewDataArgs.headers
            );
            if (response.ok) {
                const musicPlaylist: IMusicPlaylist = await response.json();
                newNftsDetails.push({
                    id: nft.id,
                    metadata,
                    musicPlaylist,
                });
            } else {
                console.error("Failed to fetch data from NFT", response);
            }
        }

        this.client.holdings.append(newNfts.map((nft) => nft.id));
        return newNftsDetails;
    }

    public async checkNewNfts(): Promise<DasApiAsset[]> {
        elizaLogger.log("🚀 Checking new NFTs...");

        const latestNfts = await this.checkNftBalance(
            "JAWEFUJSWErkDj8RefehQXGp1nUhCoWbtZnpeo8Db8KN"
        );

        const processedAssetIds = await this.client.holdings.getAll();

        const newNfts = latestNfts.filter(
            (nft) => !processedAssetIds.includes(nft.id)
        );

        if (newNfts.length === 0) {
            elizaLogger.log("No new NFTs found");
        }
        return newNfts;
    }

    public async checkNftBalance(
        collection: string | string[]
    ): Promise<DasApiAsset[]> {
        elizaLogger.log("🚀 Checking NFT balance...");

        const nfts = await this.mplBubblegumProvider.getAssetsByOwner(
            this.mplBubblegumProvider.getKeypairPublicKey()
        );

        const collections = Array.isArray(collection)
            ? collection
            : [collection];

        return nfts.items.filter((nft) =>
            nft.grouping.some((group) =>
                collections.includes(group.group_value)
            )
        );
    }

    public async checkTensorActivity() {
        elizaLogger.log("🚀 Checking tensor activity...");

        const processedListings: string[] =
            await this.client.tensorListings.getAll();
        const processedBuys: string[] = await this.client.tensorBuys.getAll();

        const latestTensorActivity: TensorResponse =
            await this.getTensorActivity();
        const { listings, buys } =
            this.parseTensorActivity(latestTensorActivity);

        const newListings = listings.filter(
            (listing) => !processedListings.includes(listing.onchainId)
        );
        const newBuys = buys.filter(
            (buy) => !processedBuys.includes(buy.onchainId)
        );

        if (newListings.length > 0) {
            await this.client.tensorListings.append(
                newListings.map((listing) => listing.onchainId)
            );
        } else {
            elizaLogger.log("No new listings found");
        }

        if (newBuys.length > 0) {
            await this.client.tensorBuys.append(
                newBuys.map((buy) => buy.onchainId)
            );
        } else {
            elizaLogger.log("No new buys found");
        }

        return {
            listings: newListings,
            buys: newBuys,
        };
    }

    public async getTensorActivity(): Promise<TensorResponse> {
        const postQuery = `https://graphql.tensor.trade/graphql`;
        const graphQl = {
            operationName: "RecentTransactions",
            variables: {
                slug: "db2b6fbc-64b9-4209-9bdb-497e55571e5a",
                limit: 50,
                keepLatestListDelistOnly: false,
                filters: {
                    txTypes: ["SALE_BUY_NOW", "LIST"],
                    mps: null,
                    prices: null,
                    traitCount: null,
                    traits: null,
                },
            },
            query: "query RecentTransactions($slug: String, $keepLatestListDelistOnly: Boolean!, $filters: TransactionsFilters, $limit: Int) { recentTransactionsV2(slug: $slug, keepLatestListDelistOnly: $keepLatestListDelistOnly, filters: $filters, limit: $limit) { txs { tx { txType txAt } mint { onchainId } } } }",
        };

        const response = await fetch(postQuery, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(graphQl),
        });

        const data = (await response.json()) as TensorResponse;

        return data;
    }

    public parseTensorActivity(response: TensorResponse) {
        const activity = response.data.recentTransactionsV2.txs;

        const listings = activity
            .filter((tx) => tx.tx.txType === "LIST")
            .map((tx) => ({
                onchainId: tx.mint.onchainId,
                txAt: tx.tx.txAt,
            }));

        const buys = activity
            .filter((tx) => tx.tx.txType === "SALE_BUY_NOW")
            .map((tx) => ({
                onchainId: tx.mint.onchainId,
                txAt: tx.tx.txAt,
            }));

        return {
            listings,
            buys,
        };
    }

    public async viewData(
        assetId: string,
        nonce: string,
        signature: string,
        address: PublicKey,
        fwdHeaderKeys?: string[],
        headers?: any,
        streamInLine?: boolean,
        nestedIdxToStream?: number,
        cacheDurationSeconds?: number
    ): Promise<Response> {
        let accessUrl = `${this.dataMarshalApi}/access?nonce=${nonce}&NFTId=${assetId}&signature=${signature}&chainId=${this.chainId}&accessRequesterAddr=${address.toBase58()}`;

        if (streamInLine) {
            accessUrl += `&streamInLine=1`;
        }
        if (nestedIdxToStream !== undefined) {
            accessUrl += `&nestedIdxToStream=${nestedIdxToStream}`;
        }
        if (fwdHeaderKeys && fwdHeaderKeys.length > 0) {
            accessUrl += `&fwdHeaderKeys=${fwdHeaderKeys.join(",")}`;
        }
        if (cacheDurationSeconds && cacheDurationSeconds > 0) {
            accessUrl += `&cacheDurationSeconds=${cacheDurationSeconds}`;
        }
        const response = await fetch(accessUrl, { headers });
        return response;
    }

    private async preaccess(): Promise<string> {
        const preaccessUrl = `${this.dataMarshalApi}/preaccess?chainId=${this.chainId}`;
        const response = await fetch(preaccessUrl);
        const data = await response.json();
        return data.nonce;
    }

    private async processSingleMediaFile(fileUri: string, fileType: string) {
        try {
            const response = await fetch(fileUri);
            const arrayBuffer = await response.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);

            // Compress if it's a GIF and over 4.5MB
            if (fileType === "image/gif" && buffer.length > 5 * 1024 * 1024) {
                console.log(
                    "GIF size before compression:",
                    buffer.length / 1024 / 1024,
                    "MB"
                );
                buffer = await this.compressGif(buffer);
                console.log(
                    "GIF size after compression:",
                    buffer.length / 1024 / 1024,
                    "MB"
                );
            }

            return {
                data: buffer,
                mediaType: fileType || "image/jpeg",
            };
        } catch (error) {
            console.error("Error processing media file:", error);
            throw error;
        }
    }

    private async compressGif(mediaData: Buffer): Promise<Buffer> {
        try {
            const sharpModule = await import("sharp");
            const sharp = sharpModule.default;

            const image = sharp(mediaData, { animated: true });
            const metadata = await image.metadata();

            const targetSize = 5 * 1024 * 1024;
            const ratio = Math.min(1, targetSize / mediaData.length);

            const newWidth = Math.round(metadata.width * Math.sqrt(ratio));
            const newHeight = Math.round(metadata.height * Math.sqrt(ratio));

            let compressedBuffer = await image
                .resize(newWidth, newHeight, {
                    fit: "inside",
                    withoutEnlargement: true,
                })
                .gif({
                    colours: 128,
                    effort: 10,
                    dither: 0.8,
                    interFrameMaxError: 8,
                    interPaletteMaxError: 3,
                })
                .toBuffer();

            // If still too large, apply more aggressive compression
            if (compressedBuffer.length > targetSize) {
                compressedBuffer = await image
                    .resize(newWidth, newHeight)
                    .gif({
                        colours: 64,
                        effort: 7,
                        dither: 0.5,
                        interFrameMaxError: 12,
                        interPaletteMaxError: 6,
                    })
                    .toBuffer();
            }

            return compressedBuffer;
        } catch (error) {
            console.error("Error compressing GIF:", error);
            throw error;
        }
    }

    private getDataMarshalApi(chainId: string): string {
        return chainId.includes("1")
            ? "https://api.itheumcloud.com/datamarshalapi/router/v1"
            : "https://api.itheumcloud-stg.com/datamarshalapi/router/v1";
    }
}
