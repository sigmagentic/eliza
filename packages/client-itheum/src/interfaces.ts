interface DataNFTAttribute {
    trait_type: string;
    value: string;
}

interface DataNFTFile {
    [key: string]: unknown;
}

export interface IDataNFT {
    animation_url: string;
    attributes: DataNFTAttribute[];
    description: string;
    external_url: string;
    image: string;
    name: string;
    properties: {
        category: string;
        files: DataNFTFile[];
    };
    symbol: string;
}

interface MarshalManifest {
    totalItems: number;
    nestedStream: boolean;
}

interface DataStream {
    category: string;
    name: string;
    creator: string;
    created_on: string;
    last_modified_on: string;
    marshalManifest: MarshalManifest;
}

interface Track {
    idx: number;
    date: string;
    category: string;
    artist: string;
    album: string;
    cover_art_url: string;
    title: string;
}

export interface IMusicPlaylist {
    data_stream: DataStream;
    data: Track[];
}

export interface TensorResponse {
    data: {
        recentTransactionsV2: {
            txs: Array<{
                tx: {
                    txType: "SALE_BUY_NOW" | "LIST";
                    txAt: number;
                };
                mint: {
                    onchainId: string;
                };
            }>;
        };
    };
}
