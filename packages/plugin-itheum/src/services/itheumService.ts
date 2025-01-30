import {
    elizaLogger,
    IAgentRuntime,
    Service,
    ServiceType,
} from "@elizaos/core";
import { Connection, Keypair } from "@solana/web3.js";
import { ItheumManager } from "agent-sdk";
import bs58 from "bs58";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { TrackInfo } from "../types";

export class ItheumService extends Service {
    private manager: ItheumManager;
    private connection: Connection;
    private keypair: Keypair;
    private basePath: string;
    private items = 0;

    constructor() {
        super();
    }

    getBasePath(): string {
        return this.basePath;
    }

    private removeAndCreateAssetsFolder(): void {
        const assetsPath = path.join(this.basePath, "assets");
        fs.rmSync(assetsPath, { recursive: true, force: true });
        fs.mkdirSync(assetsPath, { recursive: true });
        for (const folder of ["audio", "images"]) {
            fs.mkdirSync(path.join(assetsPath, folder), { recursive: true });
        }
    }

    private readTrackInfo(): TrackInfo {
        const infoPath = path.join(this.basePath, "assets", "info.json");
        if (!fs.existsSync(infoPath)) return [];
        const existingInfo = fs.readFileSync(infoPath, "utf8");
        return JSON.parse(existingInfo) as TrackInfo;
    }

    private writeTrackInfo(trackInfo: TrackInfo): void {
        const infoPath = path.join(this.basePath, "assets", "info.json");
        fs.writeFileSync(infoPath, JSON.stringify(trackInfo, null, 2));
    }

    private createTempFolderStructure(): void {
        try {
            this.removeAndCreateAssetsFolder();
        } catch (err) {
            console.error("Failed to create assets folder structure:", err);
        }
    }

    static get serviceType() {
        return ServiceType.ITHEUM;
    }

    async initialize(runtime: IAgentRuntime, basePath?: string): Promise<void> {
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

        this.basePath = path.resolve(
            basePath || path.join(os.tmpdir(), "itheum-temp")
        );

        this.createTempFolderStructure();
    }

    async buildUploadMintMusicNFTs(params: {
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

    private storeBufferToFile(
        buffer: Buffer,
        subFolder: string,
        fileName: string
    ): string {
        const filePath = path.join(
            this.basePath,
            "assets",
            subFolder,
            fileName
        );
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }

    private saveTrackData(
        trackData: Buffer,
        trackMetadata: {
            artist: string;
            album: string;
            title: string;
            category: string;
        },
        trackNumber: number
    ): void {
        this.storeBufferToFile(trackData, "audio", `track${trackNumber}.mp3`);
        let trackInfo = this.readTrackInfo();
        trackInfo.push({
            [`track${trackNumber}`]: { metadata: trackMetadata },
        });
        this.writeTrackInfo(trackInfo);
    }

    storeTrackToFolder(params: {
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
    }): void {
        this.items += 1;
        this.saveTrackData(
            params.track.data,
            params.track.metadata,
            this.items
        );

        if (params.track.image) {
            this.storeBufferToFile(
                params.track.image,
                "images",
                `track${this.items}_cover.jpg`
            );
        }
    }

    storeTracksToFolder(params: {
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
    }): void {
        for (let i = 0; i < params.tracks.length; i++) {
            this.storeTrackToFolder({
                track: params.tracks[i],
            });
        }
    }

    storeAnimationToFolder(params: {
        animation: Buffer;
        extension?: string;
    }): string {
        return this.storeBufferToFile(
            params.animation,
            "",
            `animation.${params.extension || "png"}`
        );
    }
}
