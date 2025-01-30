export type TrackInfo = Array<{
    [trackName: string]: {
        metadata: {
            artist: string;
            album: string;
            title: string;
            category: string;
        };
    };
}>;
