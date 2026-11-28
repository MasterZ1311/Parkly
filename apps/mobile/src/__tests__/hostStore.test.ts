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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('../services/notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(async () => undefined),
}));

import { useAuthStore } from '../store/auth.store';
import { getActiveHostDemoSpaces, useHostStore } from '../store/host.store';

describe('useHostStore private parking listing flow', () => {
  beforeEach(() => {
    mockMemoryMap.clear();
    useAuthStore.setState({
      isDemoMode: true,
      isAuthenticated: true,
      user: {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Arjun Kumar (Demo)',
        phone: '+919876543211',
        role: 'driver',
      },
    });
    useHostStore.setState({ mySpaces: [], totalEarnings: 0, loading: false, saving: false });
  });

  it('stores a private house listing with plot photos as pending_verification until approved', async () => {
    const created = await useHostStore.getState().createPrivateSpace({
      name: '18 Lake View House Driveway',
      spaceType: 'private_house',
      entryInstructions: 'Ring bell at ground floor gate.',
      address: '18 Lake View Road',
      area: 'Adyar',
      pincode: '600020',
      totalCapacity: 1,
      hourlyRate: 30,
      evCharging: false,
      covered: true,
      gated: true,
      vehicleTypes: ['sedan', 'compact'],
      photoUrls: ['sample://parkly-kyc/plot-1.jpg'],
      ownershipProofUrl: 'sample://parkly-kyc/tax-receipt.jpg',
    });

    expect(created.spaceType).toBe('private_house');
    expect(created.status).toBe('pending_verification');
    expect(created.photoUrls).toEqual(['sample://parkly-kyc/plot-1.jpg']);
    expect(useAuthStore.getState().user?.role).toBe('host');
    expect(getActiveHostDemoSpaces()).toHaveLength(0);

    // Once approved (active), it appears in driver search and supports availability toggling
    useHostStore.setState({
      mySpaces: [{ ...created, status: 'active' }],
    });
    expect(getActiveHostDemoSpaces().map((s) => s.id)).toContain(created.id);

    const toggled = await useHostStore.getState().toggleSpaceAvailability(created.id);
    expect(toggled?.status).toBe('inactive');
    expect(getActiveHostDemoSpaces()).toHaveLength(0);
  });
});
