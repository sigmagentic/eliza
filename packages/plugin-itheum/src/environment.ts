import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const itheumEnvSchema = z.object({
    SOLANA_RPC_URL: z.string().min(1, "Solana RPC URL is required"),
    SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
    ITHEUM_API_URL: z.string().min(1, "Itheum API URL is required"),
    ITHEUM_MARSHAL_URL: z.string().min(1, "Itheum Marshal URL is required"),
    ITHEUM_MINT_URL: z.string().min(1, "Itheum Mint URL is required"),
    ITHEUM_PRIORITY_FEE: z
        .number()
        .min(0, "Priority fee must be a non-negative number")
        .default(1000000),
});

export type ItheumConfig = z.infer<typeof itheumEnvSchema>;

export async function validateItheumConfig(
    runtime: IAgentRuntime
): Promise<ItheumConfig> {
    try {
        const config = {
            SOLANA_RPC_URL:
                runtime.getSetting("SOLANA_RPC_URL") ||
                process.env.SOLANA_RPC_URL,
            SOLANA_PRIVATE_KEY:
                runtime.getSetting("SOLANA_PRIVATE_KEY") ||
                process.env.SOLANA_PRIVATE_KEY,
            ITHEUM_API_URL:
                runtime.getSetting("ITHEUM_API_URL") ||
                process.env.ITHEUM_API_URL,
            ITHEUM_MARSHAL_URL:
                runtime.getSetting("ITHEUM_MARSHAL_URL") ||
                process.env.ITHEUM_MARSHAL_URL,
            ITHEUM_MINT_URL:
                runtime.getSetting("ITHEUM_MINT_URL") ||
                process.env.ITHEUM_MINT_URL,
            ITHEUM_PRIORITY_FEE:
                Number(runtime.getSetting("ITHEUM_PRIORITY_FEE")) ||
                Number(process.env.ITHEUM_PRIORITY_FEE) ||
                1000000,
        };

        return itheumEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Itheum configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
