/**
 * Pure TypeScript Base32 Geohash encoder and decoder supporting arbitrary precision.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BITS = [16, 8, 4, 2, 1];

export interface GeohashBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Encodes latitude and longitude to a Geohash string of specified precision.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 7): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;
  let geohash = '';
  let bits = 0;
  let ch = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        ch |= 1 << (4 - bits);
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= 1 << (4 - bits);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isEven = !isEven;
    if (bits < 4) {
      bits++;
    } else {
      geohash += BASE32[ch];
      bits = 0;
      ch = 0;
    }
  }
  return geohash;
}

/**
 * Decodes a geohash string into its bounding box.
 */
export function decodeGeohashBounds(geohash: string): GeohashBounds {
  let isEven = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash.charAt(i).toLowerCase();
    const cd = BASE32.indexOf(c);
    if (cd === -1) {
      throw new Error(`Invalid geohash character: ${c}`);
    }

    for (let j = 0; j < 5; j++) {
      const mask = BITS[j] ?? 0;
      if (isEven) {
        const mid = (lonMin + lonMax) / 2;
        if ((cd & mask) !== 0) {
          lonMin = mid;
        } else {
          lonMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if ((cd & mask) !== 0) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return { latMin, latMax, lonMin, lonMax };
}

/**
 * Decodes a geohash string to approximate center coordinates.
 */
export function decodeGeohash(geohash: string): Coordinates {
  const bounds = decodeGeohashBounds(geohash);
  return {
    latitude: (bounds.latMin + bounds.latMax) / 2,
    longitude: (bounds.lonMin + bounds.lonMax) / 2,
  };
}
