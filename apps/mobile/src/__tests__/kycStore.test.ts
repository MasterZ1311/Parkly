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
import { maskGovIdNumber, useKycStore } from '../store/kyc.store';

describe('useKycStore Driver & Host KYC persistence', () => {
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
    useKycStore.setState({ driverKyc: null, hostKyc: null, loading: false, saving: false });
  });

  it('masks sensitive government ID numbers while keeping last 4 chars', () => {
    expect(maskGovIdNumber('aadhaar', '1234 5678 9012')).toBe('XXXX-XXXX-9012');
    expect(maskGovIdNumber('pan', 'abcde1234f')).toBe('XXXXXX234F');
  });

  it('stores Driver KYC (DL, Vehicle Reg, RC Book) & Host KYC (ID, Ownership Proof, Plot Photos)', async () => {
    const driverSaved = await useKycStore.getState().submitDriverKyc({
      fullName: 'Arjun Kumar',
      drivingLicenseNumber: 'tn01 20190012345',
      drivingLicenseFrontUrl: 'sample://parkly-kyc/dl-front.jpg',
      govIdType: 'aadhaar',
      govIdNumberMasked: '123456789012',
      govIdDocumentUrl: 'sample://parkly-kyc/aadhaar.jpg',
      vehiclePlate: 'tn 01 ab 1234',
      rcNumber: 'rc-tn01-8841',
      rcDocumentUrl: 'sample://parkly-kyc/rc-book.jpg',
    });

    expect(driverSaved.drivingLicenseNumber).toBe('TN0120190012345');
    expect(driverSaved.vehiclePlate).toBe('TN01AB1234');
    expect(driverSaved.rcNumber).toBe('RC-TN01-8841');
    expect(driverSaved.govIdNumberMasked).toBe('XXXX-XXXX-9012');
    expect(driverSaved.status).toBe('pending');

    const hostSaved = await useKycStore.getState().submitHostKyc({
      kycFullName: 'Arjun Kumar',
      govIdType: 'pan',
      govIdNumberMasked: 'ABCDE1234F',
      govIdDocumentUrl: 'sample://parkly-kyc/host-pan.jpg',
      ownershipProofType: 'property_tax',
      ownershipDocumentUrl: 'sample://parkly-kyc/tax.jpg',
      plotPhotoUrls: ['sample://parkly-kyc/plot-1.jpg', 'sample://parkly-kyc/plot-2.jpg'],
    });

    expect(hostSaved.verificationStatus).toBe('pending');
    expect(hostSaved.plotPhotoUrls).toHaveLength(2);

    useKycStore.setState({ driverKyc: null, hostKyc: null });
    await useKycStore.getState().loadKycs();
    expect(useKycStore.getState().driverKyc?.rcNumber).toBe('RC-TN01-8841');
    expect(useKycStore.getState().hostKyc?.plotPhotoUrls).toHaveLength(2);
  });
});
