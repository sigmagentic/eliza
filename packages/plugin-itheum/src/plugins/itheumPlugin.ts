import { Plugin } from "@elizaos/core";
import { ItheumService } from "../services/itheumService";

export const itheumPlugin: Plugin = {
    name: "itheum",
    description: "Enables creation of data NFTs",
    actions: [],
    providers: [],
    evaluators: [],
    services: [new ItheumService()],
    clients: [],
};
