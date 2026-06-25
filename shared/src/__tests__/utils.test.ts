// ============================================================
// Tests — Shared Utils
// ============================================================

import { encodeGeohash, haversineDistanceKm, formatDistance, generateOtp } from '../utils';

describe('haversineDistanceKm', () => {
  it('calculates zero distance for same point', () => {
    expect(haversineDistanceKm(13.0827, 80.2707, 13.0827, 80.2707)).toBeCloseTo(0, 5);
  });

  it('calculates ~5km between two Chennai locations', () => {
    const dist = haversineDistanceKm(13.0827, 80.2707, 13.0418, 80.2341);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('returns positive distance', () => {
    const dist = haversineDistanceKm(13.0, 80.0, 14.0, 81.0);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('formatDistance', () => {
  it('formats meters for distances < 1km', () => {
    expect(formatDistance(0.5)).toEqual({ value: 500, unit: 'm' });
  });

  it('formats km for distances >= 1km', () => {
    expect(formatDistance(2.5)).toEqual({ value: 2.5, unit: 'km' });
  });
});

describe('encodeGeohash', () => {
  it('returns a string of specified precision', () => {
    const hash = encodeGeohash(13.0827, 80.2707, 7);
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(7);
  });

  it('nearby coordinates have same prefix', () => {
    const h1 = encodeGeohash(13.0827, 80.2707, 5);
    const h2 = encodeGeohash(13.0830, 80.2710, 5);
    // Very close points should share a 4-char prefix
    expect(h1.slice(0, 4)).toBe(h2.slice(0, 4));
  });
});

describe('generateOtp', () => {
  it('generates a 6-digit string', () => {
    const otp = generateOtp();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it('generates different OTPs', () => {
    const otps = new Set(Array.from({ length: 100 }, generateOtp));
    // Should have more than 50 unique values out of 100 (basic randomness check)
    expect(otps.size).toBeGreaterThan(50);
  });
});
