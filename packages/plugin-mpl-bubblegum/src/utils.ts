import { IAgentRuntime } from "@elizaos/core";
import { DeriveKeyProvider, TEEMode } from "@elizaos/plugin-tee";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Gets either a keypair or public key based on TEE mode and runtime settings
 * @param runtime The agent runtime
 * @param requirePrivateKey Whether to return a full keypair (true) or just public key (false)
 * @returns KeypairResult containing either keypair or public key
 */
export async function getWalletKey(
    runtime: IAgentRuntime
): Promise<{ keypair: Keypair }> {
    const teeMode = runtime.getSetting("TEE_MODE") || TEEMode.OFF;

    if (teeMode !== TEEMode.OFF) {
        const walletSecretSalt = runtime.getSetting("WALLET_SECRET_SALT");
        if (!walletSecretSalt) {
            throw new Error(
                "WALLET_SECRET_SALT required when TEE_MODE is enabled"
            );
        }

        const deriveKeyProvider = new DeriveKeyProvider(teeMode);
        const deriveKeyResult = await deriveKeyProvider.deriveEd25519Keypair(
            "/",
            walletSecretSalt,
            runtime.agentId
        );

        return { keypair: deriveKeyResult.keypair };
    }

    // TEE mode is OFF

    const privateKeyString =
        runtime.getSetting("MPL_BUBBLEGUM_PRIVATE_KEY") ??
        runtime.getSetting("SOLANA_PRIVATE_KEY") ??
        runtime.getSetting("WALLET_PRIVATE_KEY");

    if (!privateKeyString) {
        throw new Error("Private key not found in settings");
    }

    try {
        // First try base58
        const secretKey = bs58.decode(privateKeyString);
        return { keypair: Keypair.fromSecretKey(secretKey) };
    } catch (e) {
        console.log("Error decoding base58 private key:", e);
        try {
            // Then try base64
            console.log("Try decoding base64 instead");
            const secretKey = Uint8Array.from(
                Buffer.from(privateKeyString, "base64")
            );
            return { keypair: Keypair.fromSecretKey(secretKey) };
        } catch (e2) {
            console.error("Error decoding private key: ", e2);
            throw new Error("Invalid private key format");
        }
    }
}
