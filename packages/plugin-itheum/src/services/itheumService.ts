import { IAgentRuntime, Service, ServiceType } from "@elizaos/core";
import { Connection, Keypair } from "@solana/web3.js";
import { ItheumManager } from "agent-sdk";
import bs58 from "bs58";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
export class ItheumService extends Service {
    private manager: ItheumManager;
    private connection: Connection;
    private keypair: Keypair;
    private basePath: string;

    constructor(basePath?: string) {
        super();
        this.basePath = path.resolve(
            basePath || path.join(os.tmpdir(), "itheum-temp")
        );
        this.createTempFolderStructure();
    }

    getBasePath(): string {
        return this.basePath;
    }

    private createTempFolderStructure(): void {
        const assetsPath = path.join(this.basePath, "assets");
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath, { recursive: true });
        }

        const folders = ["audio", "images"];
        for (const folder of folders) {
            const folderPath = path.join(assetsPath, folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }
        }
    }

    static get serviceType() {
        return ServiceType.ITHEUM;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Initialize Solana connection
        this.connection = new Connection(
            runtime.getSetting("SOLANA_RPC_URL") ||
                "https://api.mainnet-beta.solana.com",
            "confirmed"
        );

        // Initialize keypair from environment variable
        const privateKey = runtime.getSetting("SOLANA_PRIVATE_KEY");
        if (!privateKey) {
            throw new Error(
                "SOLANA_PRIVATE_KEY environment variable is required"
            );
        }

        this.keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

        // Initialize the ItheumManager
        this.manager = new ItheumManager({
            connection: this.connection,
            keypair: this.keypair,
            apiUrl:
                runtime.getSetting("ITHEUM_API_URL") ||
                process.env.ITHEUM_API_URL,
            marshalUrl:
                runtime.getSetting("ITHEUM_MARSHAL_URL") ||
                process.env.ITHEUM_MARSHAL_URL,
            mintUrl:
                runtime.getSetting("ITHEUM_MINT_URL") ||
                process.env.ITHEUM_MINT_URL,
            priorityFee:
                Number(runtime.getSetting("ITHEUM_PRIORITY_FEE")) ||
                Number(process.env.PRIORITY_FEE) ||
                0,
        });
    }

    async uploadMusicNFTs(params: {
        playlist: {
            name: string;
            creator: string;
        };
        nft: {
            tokenName: string;
            sellerFeeBasisPoints: number;
            quantity: number;
            name: string;
            description: string;
        };
        animation: {
            animationFile: string;
        };
    }) {
        try {
            const result = await this.manager.buildUploadMintMusicNFTs({
                folderPath: path.join(this.basePath, "assets"),
                ...params,
            });
            // automatically remove the tmp folder
            fs.rmSync(path.join(this.basePath, "assets"), {
                recursive: true,
                force: true,
            });
            return result;
        } catch (error) {
            console.error("Failed to upload music NFTs:", error);
            throw error;
        }
    }

    private async storeBufferToFile(
        buffer: Buffer,
        subFolder: string,
        fileName: string
    ): Promise<string> {
        const filePath = path.join(
            this.basePath,
            "assets",
            subFolder,
            fileName
        );
        await fs.promises.writeFile(filePath, buffer);
        return filePath;
    }

    private async saveTrackData(
        trackData: Buffer,
        trackMetadata: {
            artist: string;
            album: string;
            title: string;
            category: string;
        },
        trackNumber: number
    ): Promise<void> {
        // Save audio file using the generic method
        await this.storeBufferToFile(
            trackData,
            "audio",
            `track${trackNumber}.mp3`
        );

        // Update info.json
        const infoPath = path.join(this.basePath, "assets", "info.json");
        let trackInfo = [];

        if (fs.existsSync(infoPath)) {
            const existingInfo = await fs.promises.readFile(infoPath, "utf8");
            trackInfo = JSON.parse(existingInfo);
        }

        trackInfo.push({
            [`track${trackNumber}`]: {
                metadata: trackMetadata,
            },
        });

        await fs.promises.writeFile(
            infoPath,
            JSON.stringify(trackInfo, null, 2)
        );
    }

    async storeTrackToFolder(params: {
        track: {
            data: Buffer;
            metadata: {
                artist: string;
                album: string;
                title: string;
                category: string;
            };
            image: Buffer;
        };
        trackNumber: number;
    }): Promise<void> {
        await this.saveTrackData(
            params.track.data,
            params.track.metadata,
            params.trackNumber
        );

        if (params.track.image) {
            await this.storeBufferToFile(
                params.track.image,
                "images",
                `track${params.trackNumber}_cover.jpg`
            );
        }
    }

    async storeTracksToFolder(params: {
        tracks: Array<{
            data: Buffer;
            metadata: {
                artist: string;
                album: string;
                title: string;
                category: string;
            };
            image: Buffer;
        }>;
    }): Promise<void> {
        for (let i = 0; i < params.tracks.length; i++) {
            await this.storeTrackToFolder({
                track: params.tracks[i],
                trackNumber: i + 1,
            });
        }
    }

    async storeAnimationToFolder(params: {
        animation: Buffer;
        extension?: string;
    }): Promise<string> {
        return this.storeBufferToFile(
            params.animation,
            "images",
            `animation.${params.extension || "png"}`
        );
    }
}
