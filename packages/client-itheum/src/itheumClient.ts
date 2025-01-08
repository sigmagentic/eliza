import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
    base58,
    DasApiAsset,
    MplBubblegumProvider,
} from "@elizaos/plugin-mpl-bubblegum";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { IDataNFT, IMusicPlaylist } from "./interfaces";
import { TwitterManager } from "@elizaos/client-twitter";
import { ClientBase } from "./base.ts";

const twitterPostTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}} about an enthusiastic music data NFT drop/release announcement.
Your response should be 1 or 2 sentences (choose the length at random).
Write a social media post that announces and celebrates receiving a new  music data NFT, following these parameters:

Album: {{albumTitle}}
Artist: {{artist}}
Total Tracks: {{totalTracks}}
Audio Preview: {{audioPreview}}
Hashtags: {{hashtags}}

Guidelines:
- Write in natural sentences (avoid "featuring X tracks" or listing details)
- Keep it conversational and fluid
- Place preview link at the end followed by hashtags
- Maintain excitement without formal announcement structure
- No "I'm excited to announce" or similar formal phrases

Example format:
"Just dropped {{albumTitle}} by {{artist}} 🎵 Check out these {{totalTracks}} tracks here: {{audioPreview}} \\n\\n #hashtags"

Instead of:
"I'm thrilled to announce that I've acquired [album name] featuring [X] tracks..."

Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only.The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;

export class ItheumClient {
    private client: ClientBase;
    private mplBubblegumProvider: MplBubblegumProvider;
    private dataMarshalApi: string;
    private chainId: string;
    private keypair: Keypair;

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
    }

    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Itheum client...");
        try {
            await this.initializeClient(true); // enableSearch
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Itheum client:", error);
            throw error;
        }
    }

    public async initializeClient(enableSearch: boolean): Promise<void> {
        elizaLogger.log("🚀 Initializing Itheum client...");

        const handleFetchLoop = async () => {
            const nftsDetails = await this.fetchDataFromNfts();

            // TO DO: abstract twitter manager in the client
            const twitterManager = new TwitterManager(
                this.client.runtime,
                enableSearch
            );

            await twitterManager.client.init();

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

                const artwork = await this.processSingleMediaFile(
                    nftDetails.metadata.properties.files[0].uri as string,
                    nftDetails.metadata.properties.files[0].type as string
                );

                await twitterManager.post.generateNewTweet(
                    twitterPostTemplate,
                    additionalParams,
                    [artwork]
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

        this.client.appendAssetIds(newNfts.map((nft) => nft.id));
        return newNftsDetails;
    }

    public async checkNewNfts(): Promise<DasApiAsset[]> {
        elizaLogger.log("🚀 Checking new NFTs...");

        const latestNfts = await this.checkNftBalance(
            "JAWEFUJSWErkDj8RefehQXGp1nUhCoWbtZnpeo8Db8KN"
        );

        const processedAssetIds = await this.client.getAssetIds();

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
