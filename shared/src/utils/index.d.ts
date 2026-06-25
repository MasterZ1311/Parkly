/**
 * Generate a cryptographically secure 6-digit OTP.
 */
export declare function generateOtp(): string;
/**
 * Generate a new UUID v4.
 */
export declare function generateId(): string;
/**
 * Calculate geohash for a coordinate pair.
 * Uses a simple prefix-based geohash for spatial indexing.
 * Precision 7 = ~150m accuracy.
 */
export declare function encodeGeohash(lat: number, lng: number, precision?: number): string;
/**
 * Calculate distance between two coordinates in kilometers (Haversine).
 */
export declare function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Format distance to human-readable string.
 */
export declare function formatDistance(km: number): {
    value: number;
    unit: 'km' | 'm';
};
/**
 * Get geohash neighbors (adjacent cells) for cross-boundary search.
 */
export declare function getGeohashNeighbors(geohash: string): string[];
/**
 * Mask a sensitive string (for logging).
 */
export declare function maskString(str: string, visibleChars?: number): string;
/**
 * Sleep for N milliseconds.
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Chunk an array into batches.
 */
export declare function chunkArray<T>(arr: T[], size: number): T[][];
//# sourceMappingURL=index.d.ts.map