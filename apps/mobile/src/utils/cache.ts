// ============================================================
// Parkly Mobile — Type-safe AsyncStorage Cache Utility
// Supports TTL (Time To Live), envelope wrapping, and error handling.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  USER_PROFILE: '@parkly/user_profile',
  RECENT_BOOKINGS: '@parkly/recent_bookings',
  LAST_SEARCH: '@parkly/last_search',
  LAST_CONCIERGE_REC: '@parkly/last_concierge_rec',
  CACHED_SPACES: '@parkly/cached_spaces',
  SAVED_PLACES: '@parkly/saved_places',
  PREFERRED_UPI: '@parkly/preferred_upi',
  NETWORK_STATUS: '@parkly/network_status',
  DEMO_MODE: '@parkly/demo_mode',
  VEHICLES: '@parkly/vehicles',
  UPI_METHODS: '@parkly/upi_methods',
  NOTIFICATION_PREFS: '@parkly/notification_prefs',
  NOTIFICATION_INBOX: '@parkly/notification_inbox',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

export interface CacheEnvelope<T> {
  timestamp: number;
  ttlMs?: number;
  data: T;
}

/**
 * Persists data to AsyncStorage within a timestamped envelope.
 * Optionally accepts a TTL (in milliseconds).
 */
export async function cacheSet<T>(key: string, data: T, ttlMs?: number): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      timestamp: Date.now(),
      ttlMs,
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[Cache] Error setting key "${key}":`, err);
  }
}

/**
 * Retrieves cached data from AsyncStorage.
 * Returns null if key doesn't exist, if JSON parsing fails,
 * or if the TTL has expired (in which case expired data is cleared).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    if (envelope.ttlMs && Date.now() - envelope.timestamp > envelope.ttlMs) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return envelope.data;
  } catch (err) {
    console.warn(`[Cache] Error getting key "${key}":`, err);
    return null;
  }
}

/**
 * Removes a specific key from AsyncStorage.
 */
export async function cacheRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Cache] Error removing key "${key}":`, err);
  }
}

/**
 * Clears all cached Parkly keys.
 */
export async function cacheClearParklyData(): Promise<void> {
  try {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (err) {
    console.warn('[Cache] Error clearing Parkly cache keys:', err);
  }
}
