const mockMemoryMap = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockMemoryMap.get(key) ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockMemoryMap.set(key, val);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockMemoryMap.delete(key);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => mockMemoryMap.delete(k));
  }),
}));

import { CACHE_KEYS, cacheGet, cacheSet, cacheClearParklyData } from '../utils/cache';

describe('Parkly AsyncStorage cache utility', () => {
  beforeEach(() => {
    mockMemoryMap.clear();
    jest.clearAllMocks();
  });

  it('defines distinct storage keys for every Parkly cache domain', () => {
    const values = Object.values(CACHE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('persists values and expires them cleanly past TTL', async () => {
    await cacheSet(CACHE_KEYS.LAST_SEARCH, { query: 'T Nagar', count: 3 }, 5000);
    expect(await cacheGet(CACHE_KEYS.LAST_SEARCH)).toEqual({ query: 'T Nagar', count: 3 });

    mockMemoryMap.set(
      CACHE_KEYS.NOTIFICATION_INBOX,
      JSON.stringify({ timestamp: Date.now() - 10_000, ttlMs: 1000, data: ['stale'] }),
    );
    expect(await cacheGet(CACHE_KEYS.NOTIFICATION_INBOX)).toBeNull();
  });

  it('clears all Parkly keys via multiRemove', async () => {
    await cacheSet(CACHE_KEYS.USER_PROFILE, { id: 'u1' });
    await cacheSet(CACHE_KEYS.VEHICLES, [{ id: 'v1' }]);
    await cacheClearParklyData();
    expect(await cacheGet(CACHE_KEYS.USER_PROFILE)).toBeNull();
    expect(await cacheGet(CACHE_KEYS.VEHICLES)).toBeNull();
  });
});
