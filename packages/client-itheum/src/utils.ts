export function getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diffInMillis = now - timestamp;
    const diffInMinutes = Math.floor(diffInMillis / (1000 * 60));
    const diffInHours = Math.floor(diffInMillis / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else {
        return `${diffInDays}d ago`;
    }
}

export function sleep(s: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
