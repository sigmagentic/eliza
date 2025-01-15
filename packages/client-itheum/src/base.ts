import { IAgentRuntime } from "@elizaos/core";
import { MplBubblegumProvider, PublicKey } from "@elizaos/plugin-mpl-bubblegum";
import { EventEmitter } from "events";

export class CacheStorage<T> {
    private runtime: IAgentRuntime;
    private cacheKey: string;
    private compareFunction: (a: T, b: T) => boolean;

    constructor(
        runtime: IAgentRuntime,
        cacheKey: string,
        compareFunction: (a: T, b: T) => boolean = (a, b) => a === b
    ) {
        this.runtime = runtime;
        this.cacheKey = cacheKey;
        this.compareFunction = compareFunction;
    }

    async append(value: T | T[]): Promise<void> {
        if (!value) {
            console.warn("Value is undefined, skipping append");
            return;
        }

        const cached = await this.getAll();
        const valuesToAdd = Array.isArray(value) ? value : [value];

        valuesToAdd.forEach((item) => {
            if (
                !cached.some((existingItem) =>
                    this.compareFunction(existingItem, item)
                )
            ) {
                cached.push(item);
            }
        });

        await this.runtime.cacheManager.set(this.cacheKey, cached);
    }

    async remove(value: T): Promise<void> {
        if (!value) {
            console.warn("Value is undefined, skipping removal");
            return;
        }

        const cached = await this.getAll();
        const filtered = cached.filter(
            (item) => !this.compareFunction(item, value)
        );
        await this.runtime.cacheManager.set(this.cacheKey, filtered);
    }

    async getAll(): Promise<T[]> {
        const cached = await this.runtime.cacheManager.get<T[]>(this.cacheKey);
        return cached || [];
    }

    async clear(): Promise<void> {
        await this.runtime.cacheManager.set(this.cacheKey, []);
    }
}

export class ClientBase extends EventEmitter {
    runtime: IAgentRuntime;

    public readonly holdings: CacheStorage<string>;
    public readonly tensorListings: CacheStorage<string>;
    public readonly tensorBuys: CacheStorage<string>;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;

        this.holdings = new CacheStorage<string>(
            runtime,
            "bubblegum/assetIds",
            (a, b) => a.toString() === b.toString()
        );

        this.tensorListings = new CacheStorage<string>(
            runtime,
            "activity/tensor/listings"
        );
        this.tensorBuys = new CacheStorage<string>(
            runtime,
            "activity/tensor/buys"
        );
    }
}
