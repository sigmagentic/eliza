import { Client, IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { ItheumClient } from "./itheumClient";
import {
    fromWeb3JsKeypair,
    getWalletKey,
    MplBubblegumProvider,
    toWeb3JsKeypair,
} from "@elizaos/plugin-mpl-bubblegum";

export const ItheumClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        // await validateItheumClientConfig(runtime);

        const { keypair } = await getWalletKey(runtime);

        const RPC_URL = runtime.getSetting("MPL_BUBBLEGUM_RPC_URL");

        const mplBubblegumProvider = new MplBubblegumProvider(
            RPC_URL,
            fromWeb3JsKeypair(keypair)
        );

        const itheumClient = new ItheumClient(
            runtime,
            mplBubblegumProvider,
            "SD",
            keypair
        );

        await itheumClient.start();

        elizaLogger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        // return tg;
    },
    stop: async (_runtime: IAgentRuntime) => {
        elizaLogger.warn("Telegram client does not support stopping yet");
    },
};

export default ItheumClientInterface;
