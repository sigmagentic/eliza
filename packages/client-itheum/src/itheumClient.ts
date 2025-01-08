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
Your response should be 1, 2, or 3 sentences (choose the length at random).

Write a social media post that announces and celebrates receiving a new  music data NFT, following these parameters:

Album Title: {{albumTitle}}
Artist: {{artist}}
Artwork Uri: {{artwork}}
Audio preview: {{audioPreview}}
Total Tracks: {{totalTracks}}
Hashtags: {{hashtags}}

Style Guidelines:
- Use an excited, enthusiastic tone
- Include emojis where natural
- Format as a short announcement
- End with the audio/mpeg uri
- Maintain authentic social media voice
- Keep the message concise but informative

Write the announcement without any additional commentary or meta-discussion. Generate only the announcement post itself.
Your response should not contain any questions. Brief, concise statements only.The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;

export class ItheumClient {
    private runtime: IAgentRuntime;
    private mplBubblegumProvider: MplBubblegumProvider;
    // TO DO: add db adapter
    private processedNfts: string[] = [];
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
        this.runtime = runtime;
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

            const twitterManager = new TwitterManager(
                this.runtime,
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
                        value: nftDetails.metadata.animation_url,
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

                await twitterManager.post.generateNewTweet(
                    twitterPostTemplate,
                    additionalParams
                );
            }

            setTimeout(
                handleFetchLoop,
                Number(this.runtime.getSetting("ITHEUM_FETCH_INTERVAL") || 60) *
                    1000 // default to 60 seconds
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

        this.processedNfts.push(...newNfts.map((nft) => nft.id.toString()));
        return newNftsDetails;
    }

    public async checkNewNfts(): Promise<DasApiAsset[]> {
        elizaLogger.log("🚀 Checking new NFTs...");

        const latestNfts = await this.checkNftBalance(
            "JAWEFUJSWErkDj8RefehQXGp1nUhCoWbtZnpeo8Db8KN" // a list of whitelisted cNFT collections
        );
        const newNfts = latestNfts.filter(
            (nft) =>
                !this.processedNfts.some((processedNft) =>
                    processedNft.includes(nft.id)
                )
        );
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

    private getDataMarshalApi(chainId: string): string {
        return chainId.includes("1")
            ? "https://api.itheumcloud.com/datamarshalapi/router/v1"
            : "https://api.itheumcloud-stg.com/datamarshalapi/router/v1";
    }
}
