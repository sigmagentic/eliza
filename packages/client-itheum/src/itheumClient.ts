import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
    DasApiAsset,
    MplBubblegumProvider,
} from "@elizaos/plugin-mpl-bubblegum";
import nacl from "tweetnacl";

export class ItheumClient {
    private runtime: IAgentRuntime;
    private mplBubblegumProvider: MplBubblegumProvider;
    // TO DO: add db adapter or store in memory
    private processedNfts: DasApiAsset[] = [];
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
            await this.initializeClient();
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Itheum client:", error);
            throw error;
        }
    }

    public async initializeClient(): Promise<void> {
        elizaLogger.log("🚀 Initializing Itheum client...");

        const handleFetchLoop = () => {
            this.fetchDataFromNft();
            setTimeout(
                handleFetchLoop,
                Number(this.runtime.getSetting("ITHEUM_FETCH_INTERVAL") || 60) *
                    1000 // default to 60 seconds
            );
        };
        handleFetchLoop();
    }

    public async fetchDataFromNft(): Promise<void> {
        elizaLogger.log("🚀 Fetching data from NFT...");
        const newNfts = await this.checkNewNfts();

        const nonce = await this.preaccess(); // fetch once per all nfts

        const nonceEncoded = new TextEncoder().encode(nonce);

        const signature = nacl.sign.detached(
            nonceEncoded,
            this.keypair.secretKey
        );

        const encodedSignature = Buffer.from(signature).toString("hex");

        for (const nft of newNfts) {
            console.log(nft.content.json_uri);
            // music nft

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
                //fetch was good
                console.log("fetch good");
            } else {
                console.log("fetch bad");
            }
            // do more with response here
        }

        this.processedNfts.push(...newNfts);
    }

    public async checkNewNfts(): Promise<DasApiAsset[]> {
        elizaLogger.log("🚀 Checking new NFTs...");

        const latestNfts = await this.checkNftBalance(
            "68U3PakyLevtZ2A87iBS7JKuWeha2bcCfLdD8tY1SZ9u"
        );
        const newNfts = latestNfts.filter(
            (nft) =>
                !this.processedNfts.some((processedNft) =>
                    processedNft.id.includes(nft.id)
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
