import { IAgentRuntime, Service, ServiceType } from "@elizaos/core";
import { Connection, Keypair } from "@solana/web3.js";
import { ItheumManager } from "agent-sdk";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
export class ItheumService extends Service {
    private manager: ItheumManager;
    private connection: Connection;
    private keypair: Keypair;

    constructor() {
        super();
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
        folderPath: string;
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
            const result = await this.manager.buildUploadMintMusicNFTs(params);
            // automatically remove the tmp folder
            fs.rmSync(params.folderPath, { recursive: true, force: true });
            return result;
        } catch (error) {
            console.error("Failed to upload music NFTs:", error);
            throw error;
        }
    }

    private async createTempFolderStructure(basePath: string): Promise<void> {
        const fs = require("fs");
        const path = require("path");

        // Create base assets folder if it doesn't exist
        const assetsPath = path.join(basePath, "assets");
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath, { recursive: true });
        }

        // Create subfolders
        const folders = ["audio", "images"];
        for (const folder of folders) {
            const folderPath = path.join(assetsPath, folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }
        }
    }

    private async saveTrackData(
        basePath: string,
        trackData: Buffer,
        trackMetadata: {
            artist: string;
            album: string;
            title: string;
            category: string;
        },
        trackNumber: number
    ): Promise<void> {
        const fs = require("fs");
        const path = require("path");

        // Save audio file
        const audioPath = path.join(
            basePath,
            "assets",
            "audio",
            `track${trackNumber}.mp3`
        );
        await fs.promises.writeFile(audioPath, trackData);

        // Update info.json
        const infoPath = path.join(basePath, "assets", "info.json");
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

    private async saveAnimationFile(
        basePath: string,
        animationData: Buffer,
        extension: string = "gif" // Default to gif if no extension provided
    ): Promise<string> {
        const fs = require("fs");
        const path = require("path");
        const fetch = require("node-fetch");

        const animationPath = path.join(
            basePath,
            "assets",
            "images",
            `animation.${extension}`
        );

        // Download from URL
        const response = await fetch(animationData);
        const buffer = await response.buffer();
        await fs.promises.writeFile(animationPath, buffer);

        return animationPath;
    }

    async processAndStoreMusicData(params: {
        basePath: string;
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
        animation?: Buffer;
        animationExtension?: string;
    }): Promise<string> {
        await this.createTempFolderStructure(params.basePath);

        // Process each track
        for (let i = 0; i < params.tracks.length; i++) {
            const track = params.tracks[i];
            await this.saveTrackData(
                params.basePath,
                track.data,
                track.metadata,
                i + 1
            );

            // Save track cover image if provided
            if (track.image) {
                const imagePath = path.join(
                    params.basePath,
                    "assets",
                    "images",
                    `track${i + 1}_cover.jpg`
                );
                await fs.promises.writeFile(imagePath, track.image);
            }
        }

        // Handle animation file if provided
        if (params.animation) {
            await this.saveAnimationFile(
                params.basePath,
                params.animation,
                params.animationExtension
            );
        }

        return params.basePath;
    }
}
