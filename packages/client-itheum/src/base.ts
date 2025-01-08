import { IAgentRuntime } from "@elizaos/core";
import { MplBubblegumProvider, PublicKey } from "@elizaos/plugin-mpl-bubblegum";
import { EventEmitter } from "events";

export class ClientBase extends EventEmitter {
    runtime: IAgentRuntime;
    private readonly CACHE_KEY = "bubblegum/assetIds";

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
    }

    async appendAssetIds(assetId: PublicKey | PublicKey[]): Promise<void> {
        if (!assetId) {
            console.warn("Asset Id is undefined, skipping append");
            return;
        }

        const assetIds = await this.getAssetIds();
        const idsToAdd = Array.isArray(assetId) ? assetId : [assetId];

        idsToAdd.forEach((id) => {
            if (
                !assetIds.find(
                    (existingId) => existingId.toString() === id.toString()
                )
            ) {
                assetIds.push(id);
            }
        });

        await this.runtime.cacheManager.set(this.CACHE_KEY, assetIds);
    }

    async removeAssetId(assetId: PublicKey): Promise<void> {
        if (!assetId) {
            console.warn("Asset Id is undefined, skipping removal");
            return;
        }

        const assetIds = await this.getAssetIds();
        const filteredIds = assetIds.filter(
            (id) => id.toString() !== assetId.toString()
        );
        await this.runtime.cacheManager.set(this.CACHE_KEY, filteredIds);
    }

    async getAssetIds(): Promise<PublicKey[]> {
        const cached = await this.runtime.cacheManager.get<PublicKey[]>(
            this.CACHE_KEY
        );
        return cached || [];
    }
}
