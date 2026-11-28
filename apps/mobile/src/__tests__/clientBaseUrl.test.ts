jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { hostUri: undefined as string | undefined },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveBaseUrl } from '../api/client';

describe('resolveBaseUrl — environment and host discovery', () => {
  const originalEnvUrl = process.env['EXPO_PUBLIC_API_URL'];
  const originalOS = Platform.OS;

  afterEach(() => {
    process.env['EXPO_PUBLIC_API_URL'] = originalEnvUrl;
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    (Constants.expoConfig as { hostUri?: string }).hostUri = undefined;
  });

  it('prefers explicit EXPO_PUBLIC_API_URL when configured', () => {
    process.env['EXPO_PUBLIC_API_URL'] = 'https://api.parkly.example/api/v1 ';
    expect(resolveBaseUrl()).toBe('https://api.parkly.example/api/v1');
  });

  it('derives LAN API URL from Expo hostUri when running on physical device', () => {
    delete process.env['EXPO_PUBLIC_API_URL'];
    (Constants.expoConfig as { hostUri?: string }).hostUri = '192.168.1.42:8081';
    expect(resolveBaseUrl()).toBe('http://192.168.1.42:4000/api/v1');
  });

  it('falls back to Android emulator loopback 10.0.2.2 without hardcoded Tailscale IPs', () => {
    delete process.env['EXPO_PUBLIC_API_URL'];
    (Constants.expoConfig as { hostUri?: string }).hostUri = 'localhost:8081';
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    const resolved = resolveBaseUrl();
    expect(resolved).toBe('http://10.0.2.2:4000/api/v1');
    expect(resolved).not.toContain('100.116.89.14');
  });

  it('falls back to localhost on iOS/web', () => {
    delete process.env['EXPO_PUBLIC_API_URL'];
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(resolveBaseUrl()).toBe('http://localhost:4000/api/v1');
  });
});
