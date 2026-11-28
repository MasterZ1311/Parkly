import { create } from 'zustand';
import {
  authApi,
  hostApi,
  tokenStorage,
  type SpaceType,
  type VehiclePayloadType,
} from '../api/client';
import { useAuthStore, type AuthUser } from './auth.store';
import { cacheGet, cacheSet, CACHE_KEYS } from '../utils/cache';
import { DEMO_HOST_ID, type DemoSpaceItem } from '../data/demoFixtures';

export interface HostOwnedSpace {
  id: string;
  hostId: string;
  name: string;
  spaceType: SpaceType;
  entryInstructions?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates: { lat: number; lng: number };
  totalCapacity: number;
  hourlyRate: number;
  vehicleTypes: VehiclePayloadType[];
  amenities: {
    evCharging: boolean;
    covered: boolean;
    securityLevel: 'none' | 'basic' | 'monitored' | 'staffed' | 'gated';
  };
  status: 'draft' | 'pending_verification' | 'active' | 'inactive' | 'suspended';
  photoUrls?: string[];
  ownershipProofUrl?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface CreatePrivateSpaceInput {
  name: string;
  spaceType: SpaceType;
  entryInstructions?: string;
  address: string;
  area: string;
  pincode: string;
  totalCapacity: number;
  hourlyRate: number;
  evCharging: boolean;
  covered: boolean;
  gated: boolean;
  vehicleTypes: VehiclePayloadType[];
  photoUrls?: string[];
  ownershipProofUrl?: string;
  coordinates?: { lat: number; lng: number };
}

const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  'T Nagar': { lat: 13.0418, lng: 80.2341 },
  'Anna Nagar': { lat: 13.0849, lng: 80.2101 },
  Adyar: { lat: 13.0067, lng: 80.2566 },
  Velachery: { lat: 12.9791, lng: 80.2204 },
  OMR: { lat: 12.9345, lng: 80.2361 },
  Mylapore: { lat: 13.0339, lng: 80.2676 },
};

function mapServerHostSpace(raw: any): HostOwnedSpace {
  return {
    id: String(raw.id),
    hostId: String(raw.hostId || ''),
    name: String(raw.name || 'My Parking Space'),
    spaceType: (raw.spaceType || 'private_house') as SpaceType,
    entryInstructions: raw.entryInstructions || undefined,
    address: String(raw.address || ''),
    city: String(raw.city || 'Chennai'),
    state: String(raw.state || 'Tamil Nadu'),
    pincode: String(raw.pincode || '600017'),
    coordinates: {
      lat: Number(raw.coordinates?.lat ?? raw.latitude ?? 13.0418),
      lng: Number(raw.coordinates?.lng ?? raw.longitude ?? 80.2341),
    },
    totalCapacity: Number(raw.totalCapacity || 1),
    hourlyRate: Number(raw.pricing?.hourlyRate ?? raw.hourlyRate ?? 30),
    vehicleTypes: Array.isArray(raw.vehicleTypes) ? raw.vehicleTypes : ['sedan'],
    amenities: {
      evCharging: Boolean(raw.amenities?.evCharging ?? raw.evCharging),
      covered: Boolean(raw.amenities?.covered ?? raw.covered),
      securityLevel: raw.amenities?.securityLevel ?? raw.securityLevel ?? 'gated',
    },
    status: raw.status || 'pending_verification',
    photoUrls: Array.isArray(raw.photoUrls) ? raw.photoUrls : [],
    ownershipProofUrl: raw.ownershipProofUrl || undefined,
    reviewNotes: raw.reviewNotes || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

interface HostStoreState {
  mySpaces: HostOwnedSpace[];
  totalEarnings: number;
  loading: boolean;
  saving: boolean;
  loadMySpaces: () => Promise<HostOwnedSpace[]>;
  createPrivateSpace: (input: CreatePrivateSpaceInput) => Promise<HostOwnedSpace>;
  toggleSpaceAvailability: (id: string) => Promise<HostOwnedSpace | null>;
}

export function hostSpaceToDemoItem(space: HostOwnedSpace): DemoSpaceItem {
  return {
    id: space.id,
    hostId: space.hostId || DEMO_HOST_ID,
    name: space.name,
    spaceType: space.spaceType,
    entryInstructions: space.entryInstructions,
    address: `${space.address}, ${space.city}`,
    coordinates: space.coordinates,
    distance: { value: 0.4, unit: 'km' },
    price: { value: space.hourlyRate, currency: 'INR', per: 'hour' },
    availability: {
      probabilityPercent: space.status === 'active' ? 96 : 0,
      confidencePercent: 95,
    },
    amenities: space.amenities,
    totalCapacity: space.totalCapacity,
  };
}

export function getActiveHostDemoSpaces(): DemoSpaceItem[] {
  return useHostStore
    .getState()
    .mySpaces.filter((s) => s.status === 'active')
    .map(hostSpaceToDemoItem);
}

export const useHostStore = create<HostStoreState>((set, get) => ({
  mySpaces: [],
  totalEarnings: 0,
  loading: false,
  saving: false,

  loadMySpaces: async () => {
    const isDemo = useAuthStore.getState().isDemoMode;
    set({ loading: true });

    try {
      if (isDemo) {
        const saved = (await cacheGet<HostOwnedSpace[]>(CACHE_KEYS.HOST_SPACES)) || [];
        set({ mySpaces: saved, totalEarnings: saved.length * 180, loading: false });
        return saved;
      }

      const [spacesResp, revResp] = await Promise.all([
        hostApi.listMySpaces(),
        hostApi.getRevenue().catch(() => null),
      ]);
      const rawList = Array.isArray(spacesResp.data?.data) ? spacesResp.data.data : [];
      const mapped = rawList.map(mapServerHostSpace);
      const earnings = Number(revResp?.data?.data?.totalEarnings ?? 0);
      await cacheSet(CACHE_KEYS.HOST_SPACES, mapped);
      set({ mySpaces: mapped, totalEarnings: earnings, loading: false });
      return mapped;
    } catch {
      const cached = (await cacheGet<HostOwnedSpace[]>(CACHE_KEYS.HOST_SPACES)) || [];
      set({ mySpaces: cached, loading: false });
      return cached;
    }
  },

  createPrivateSpace: async (input: CreatePrivateSpaceInput) => {
    const authState = useAuthStore.getState();
    const coords = input.coordinates || AREA_COORDS[input.area] || AREA_COORDS['T Nagar'];
    set({ saving: true });

    try {
      if (authState.isDemoMode) {
        const newSpace: HostOwnedSpace = {
          id: `host-space-${Date.now()}`,
          hostId: DEMO_HOST_ID,
          name: input.name.trim(),
          spaceType: input.spaceType,
          entryInstructions: input.entryInstructions?.trim() || undefined,
          address: `${input.address.trim()}, ${input.area}, Chennai ${input.pincode.trim() || '600017'}`,
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: input.pincode.trim() || '600017',
          coordinates: coords,
          totalCapacity: Math.max(1, input.totalCapacity),
          hourlyRate: Math.max(10, input.hourlyRate),
          vehicleTypes: input.vehicleTypes.length > 0 ? input.vehicleTypes : ['sedan'],
          amenities: {
            evCharging: input.evCharging,
            covered: input.covered,
            securityLevel: input.gated ? 'gated' : 'basic',
          },
          status: 'pending_verification',
          photoUrls: input.photoUrls || [],
          ownershipProofUrl: input.ownershipProofUrl,
          reviewNotes: 'Stored with plot pictures — awaiting Parkly Review Team approval.',
          createdAt: new Date().toISOString(),
        };

        const updated = [newSpace, ...get().mySpaces];
        await cacheSet(CACHE_KEYS.HOST_SPACES, updated);

        // Upgrade demo profile role to host so owner capabilities reflect locally
        if (authState.user && authState.user.role === 'driver') {
          const upgraded: AuthUser = { ...authState.user, role: 'host' };
          await cacheSet(CACHE_KEYS.USER_PROFILE, upgraded);
          useAuthStore.setState({ user: upgraded });
        }

        set({ mySpaces: updated, saving: false });
        return newSpace;
      }

      // Live mode: self-serve upgrade from driver -> host if needed
      if (authState.user && authState.user.role === 'driver') {
        const becomeResp = await authApi.becomeHost({
          businessName: `${authState.user.name} · Private Parking`,
        });
        const nextUser = becomeResp.data?.data?.user as AuthUser | undefined;
        const nextTokens = becomeResp.data?.data?.tokens as
          | { accessToken: string; refreshToken?: string }
          | undefined;
        if (nextTokens?.accessToken) {
          await tokenStorage.set('access_token', nextTokens.accessToken);
        }
        if (nextTokens?.refreshToken) {
          await tokenStorage.set('refresh_token', nextTokens.refreshToken);
        }
        if (nextUser) {
          await cacheSet(CACHE_KEYS.USER_PROFILE, nextUser);
          useAuthStore.setState({ user: nextUser });
        }
      }

      const { data } = await hostApi.createSpace({
        name: input.name.trim(),
        spaceType: input.spaceType,
        entryInstructions: input.entryInstructions?.trim() || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        address: `${input.address.trim()}, ${input.area}`,
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: input.pincode.trim() || '600017',
        totalCapacity: Math.max(1, input.totalCapacity),
        vehicleTypes: input.vehicleTypes.length > 0 ? input.vehicleTypes : ['sedan'],
        evCharging: input.evCharging,
        covered: input.covered,
        securityLevel: input.gated ? 'gated' : 'basic',
        hourlyRate: Math.max(10, input.hourlyRate),
        photoUrls: input.photoUrls,
        ownershipProofUrl: input.ownershipProofUrl,
      });

      const created = mapServerHostSpace(data?.data || {});
      const updated = [created, ...get().mySpaces];
      await cacheSet(CACHE_KEYS.HOST_SPACES, updated);
      set({ mySpaces: updated, saving: false });
      return created;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  toggleSpaceAvailability: async (id: string) => {
    const target = get().mySpaces.find((s) => s.id === id);
    if (!target) return null;

    const nextStatus = target.status === 'active' ? 'inactive' : 'active';
    const isDemo = useAuthStore.getState().isDemoMode;

    if (!isDemo) {
      await hostApi.updateSpace(id, { status: nextStatus });
    }

    const updated = get().mySpaces.map((s) =>
      s.id === id ? { ...s, status: nextStatus as HostOwnedSpace['status'] } : s,
    );
    await cacheSet(CACHE_KEYS.HOST_SPACES, updated);
    set({ mySpaces: updated });
    return updated.find((s) => s.id === id) || null;
  },
}));
