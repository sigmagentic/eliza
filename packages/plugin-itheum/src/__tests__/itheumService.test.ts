import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ItheumService } from "../services/itheumService";
import { Connection, Keypair } from "@solana/web3.js";
import { ItheumManager } from "agent-sdk";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";

// Mock @solana/web3.js
vi.mock("@solana/web3.js", () => ({
    Connection: vi.fn(),
    Keypair: {
        fromSecretKey: vi.fn(),
    },
}));

// Mock agent-sdk
vi.mock("agent-sdk", () => ({
    ItheumManager: vi.fn().mockImplementation(() => ({
        buildUploadMintMusicNFTs: vi.fn(),
    })),
}));

// Mock fs module
vi.mock("fs", () => ({
    ...(vi.importActual("fs") as any),
    promises: {
        writeFile: vi.fn(),
        readFile: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
}));

// Mock path module
vi.mock("path", () => ({
    join: vi.fn().mockImplementation((...args) => args.join("/")),
}));

// Mock bs58
vi.mock("bs58", () => ({
    decode: vi.fn(),
}));

describe("ItheumService", () => {
    let itheumService: ItheumService;
    let mockRuntime: any;
    let mockConnection: any;
    let mockKeypair: any;
    let mockItheumManager: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Setup mock runtime
        mockRuntime = {
            getSetting: vi.fn(),
        };

        // Setup mock connection
        mockConnection = new Connection("");

        // Setup mock keypair
        mockKeypair = {
            publicKey: "mockPublicKey",
            secretKey: "mockSecretKey",
        };

        // Create new instance of ItheumService
        itheumService = new ItheumService();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("initialization", () => {
        it("should initialize with default RPC URL when HELIUS_RPC_URL is not provided", async () => {
            mockRuntime.getSetting.mockImplementation((key) => {
                if (key === "WALLET_PRIVATE_KEY") return "mockPrivateKey";
                return null;
            });

            (bs58.decode as any).mockReturnValue(new Uint8Array());
            (Keypair.fromSecretKey as any).mockReturnValue(mockKeypair);

            await itheumService.initialize(mockRuntime);

            expect(Connection).toHaveBeenCalledWith(
                "https://api.mainnet-beta.solana.com",
                "confirmed"
            );
        });

        it("should throw error when WALLET_PRIVATE_KEY is not provided", async () => {
            mockRuntime.getSetting.mockReturnValue(null);

            await expect(itheumService.initialize(mockRuntime)).rejects.toThrow(
                "WALLET_PRIVATE_KEY environment variable is required"
            );
        });

        it("should initialize ItheumManager with correct parameters", async () => {
            mockRuntime.getSetting.mockImplementation((key) => {
                switch (key) {
                    case "WALLET_PRIVATE_KEY":
                        return "mockPrivateKey";
                    case "ITHEUM_API_URL":
                        return "mockApiUrl";
                    case "ITHEUM_MARSHAL_URL":
                        return "mockMarshalUrl";
                    case "ITHEUM_MINT_URL":
                        return "mockMintUrl";
                    case "PRIORITY_FEE":
                        return "1000";
                    default:
                        return null;
                }
            });

            (bs58.decode as any).mockReturnValue(new Uint8Array());
            (Keypair.fromSecretKey as any).mockReturnValue(mockKeypair);

            await itheumService.initialize(mockRuntime);

            expect(ItheumManager).toHaveBeenCalledWith({
                connection: expect.any(Connection),
                keypair: mockKeypair,
                apiUrl: "mockApiUrl",
                marshalUrl: "mockMarshalUrl",
                mintUrl: "mockMintUrl",
                priorityFee: 1000,
            });
        });
    });

    describe("uploadMusicNFTs", () => {
        beforeEach(async () => {
            // Setup successful initialization
            mockRuntime.getSetting.mockReturnValue("mockPrivateKey");
            (bs58.decode as any).mockReturnValue(new Uint8Array());
            (Keypair.fromSecretKey as any).mockReturnValue(mockKeypair);
            await itheumService.initialize(mockRuntime);
        });

        it("should successfully upload music NFTs", async () => {
            const mockParams = {
                folderPath: "mockPath",
                playlist: {
                    name: "Test Playlist",
                    creator: "Test Creator",
                },
                nft: {
                    tokenName: "Test Token",
                    sellerFeeBasisPoints: 500,
                    quantity: 1,
                    name: "Test NFT",
                    description: "Test Description",
                },
                animation: {
                    animationFile: "test.gif",
                },
            };

            const mockResult = { success: true };
            (
                itheumService as any
            ).manager.buildUploadMintMusicNFTs.mockResolvedValue(mockResult);

            const result = await itheumService.uploadMusicNFTs(mockParams);

            expect(result).toEqual(mockResult);
            expect(fs.rmSync).toHaveBeenCalledWith(mockParams.folderPath, {
                recursive: true,
                force: true,
            });
        });

        it("should handle upload errors properly", async () => {
            const mockParams = {
                folderPath: "mockPath",
                playlist: { name: "Test", creator: "Test" },
                nft: {
                    tokenName: "Test",
                    sellerFeeBasisPoints: 500,
                    quantity: 1,
                    name: "Test",
                    description: "Test",
                },
                animation: { animationFile: "test.gif" },
            };

            const mockError = new Error("Upload failed");
            (
                itheumService as any
            ).manager.buildUploadMintMusicNFTs.mockRejectedValue(mockError);

            await expect(
                itheumService.uploadMusicNFTs(mockParams)
            ).rejects.toThrow(mockError);
        });
    });

    describe("processAndStoreMusicData", () => {
        beforeEach(async () => {
            // Setup successful initialization
            mockRuntime.getSetting.mockReturnValue("mockPrivateKey");
            (bs58.decode as any).mockReturnValue(new Uint8Array());
            (Keypair.fromSecretKey as any).mockReturnValue(mockKeypair);
            await itheumService.initialize(mockRuntime);

            // Mock fs.existsSync for folder creation checks
            (fs.existsSync as any).mockReturnValue(false);
        });

        it("should process and store music data correctly", async () => {
            const mockParams = {
                basePath: "mockBasePath",
                tracks: [
                    {
                        data: Buffer.from("mockAudioData"),
                        metadata: {
                            artist: "Test Artist",
                            album: "Test Album",
                            title: "Test Track",
                            category: "Test Category",
                        },
                        image: Buffer.from("mockImageData"),
                    },
                ],
                animation: Buffer.from("mockAnimationData"),
                animationExtension: "gif",
            };

            const result =
                await itheumService.processAndStoreMusicData(mockParams);

            expect(result).toBe(mockParams.basePath);
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining("assets"),
                expect.any(Object)
            );
            expect(fs.promises.writeFile).toHaveBeenCalled();
        });

        it("should create necessary folder structure", async () => {
            const mockBasePath = "mockBasePath";
            await (itheumService as any).createTempFolderStructure(
                mockBasePath
            );

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining("assets"),
                { recursive: true }
            );
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining("audio")
            );
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining("images")
            );
        });

        it("should save track data with metadata", async () => {
            const mockTrackData = {
                basePath: "mockPath",
                trackData: Buffer.from("mockAudioData"),
                trackMetadata: {
                    artist: "Test Artist",
                    album: "Test Album",
                    title: "Test Track",
                    category: "Test Category",
                },
                trackNumber: 1,
            };

            (fs.promises.readFile as any).mockResolvedValue("[]");

            await (itheumService as any).saveTrackData(
                mockTrackData.basePath,
                mockTrackData.trackData,
                mockTrackData.trackMetadata,
                mockTrackData.trackNumber
            );

            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining("track1.mp3"),
                mockTrackData.trackData
            );
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining("info.json"),
                expect.any(String)
            );
        });
    });
});
