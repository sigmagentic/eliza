import { Plugin } from "@elizaos/core";
import transfer from "./actions/transfer";
import { MplBubblegumProvider } from "./providers/bubblegumProvider";
export * from "@metaplex-foundation/digital-asset-standard-api";
export * from "@metaplex-foundation/umi-web3js-adapters";
export * from "@metaplex-foundation/umi";
export { MplBubblegumProvider };
export { getWalletKey } from "./utils";

export const mplBubblegumPlugin: Plugin = {
    name: "mpl-bubblegum",
    description: "Bubblegum Plugin for Eliza",
    actions: [transfer],
    providers: [],
    evaluators: [],
    services: [],
    clients: [],
};
