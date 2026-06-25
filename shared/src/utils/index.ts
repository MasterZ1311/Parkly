// ============================================================
// Parkly — Shared Utilities
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';


/**
 * Generate a cryptographically secure 6-digit OTP.
 */
export function generateOtp(): string {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 900000 + 100000;
  return String(num);
}

/**
 * Generate a new UUID v4.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Calculate geohash for a coordinate pair.
 * Uses a simple prefix-based geohash for spatial indexing.
 * Precision 7 = ~150m accuracy.
 */
export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const midLng = (minLng + maxLng) / 2;
      if (lng >= midLng) { idx = idx * 2 + 1; minLng = midLng; }
      else { idx = idx * 2; maxLng = midLng; }
    } else {
      const midLat = (minLat + maxLat) / 2;
      if (lat >= midLat) { idx = idx * 2 + 1; minLat = midLat; }
      else { idx = idx * 2; maxLat = midLat; }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Calculate distance between two coordinates in kilometers (Haversine).
 */
export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Format distance to human-readable string.
 */
export function formatDistance(km: number): { value: number; unit: 'km' | 'm' } {
  if (km < 1) {
    return { value: Math.round(km * 1000), unit: 'm' };
  }
  return { value: Math.round(km * 10) / 10, unit: 'km' };
}

/**
 * Get geohash neighbors (adjacent cells) for cross-boundary search.
 */
export function getGeohashNeighbors(geohash: string): string[] {
  // Returns 8 neighbors + self
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  const NEIGHBOR: Record<string, Record<string, string>> = {
    right: { even: 'bc01fg45teleheijklmnopqrstuvwxyz', odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy' },
    left: { even: '238967debc01teleheijklmnopqrstuvwxyz', odd: '14365h7k9dcfesgujnmqp0r2twvyx8zb' },
    top: { even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', odd: 'bc01fg45teleheijklmnopqrstuvwxyz' },
    bottom: { even: '14365h7k9dcfesgujnmqp0r2twvyx8zb', odd: '238967debc01teleheijklmnopqrstuvwxyz' },
  };
  const BORDER: Record<string, Record<string, string>> = {
    right: { even: 'bcfguvyz', odd: 'prxz' },
    left: { even: '0145hjnp', odd: '028b' },
    top: { even: 'prxz', odd: 'bcfguvyz' },
    bottom: { even: '028b', odd: '0145hjnp' },
  };

  function adjacent(hash: string, dir: string): string {
    const lastChar = hash[hash.length - 1];
    const parent = hash.slice(0, -1);
    const type = hash.length % 2 ? 'odd' : 'even';
    if (BORDER[dir]?.[type]?.includes(lastChar) && parent.length > 0) {
      return adjacent(parent, dir) + BASE32[NEIGHBOR[dir]?.[type]?.indexOf(lastChar) ?? 0];
    }
    return parent + BASE32[NEIGHBOR[dir]?.[type]?.indexOf(lastChar) ?? 0];
  }

  const n = adjacent(geohash, 'top');
  const ne = adjacent(n, 'right');
  const e = adjacent(geohash, 'right');
  const se = adjacent(adjacent(geohash, 'bottom'), 'right');
  const s = adjacent(geohash, 'bottom');
  const sw = adjacent(adjacent(geohash, 'bottom'), 'left');
  const w = adjacent(geohash, 'left');
  const nw = adjacent(n, 'left');

  return [geohash, n, ne, e, se, s, sw, w, nw];
}

/**
 * Mask a sensitive string (for logging).
 */
export function maskString(str: string, visibleChars = 4): string {
  if (str.length <= visibleChars) return '***';
  return str.slice(0, visibleChars) + '*'.repeat(str.length - visibleChars);
}

/**
 * Sleep for N milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk an array into batches.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
