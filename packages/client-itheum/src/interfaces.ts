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
