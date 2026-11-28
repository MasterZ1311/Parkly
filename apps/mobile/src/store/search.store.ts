import { create } from 'zustand';
import type { VehiclePayloadType } from '../api/client';

export type ArrivalOffsetMinutes = 0 | 15 | 30 | 60 | 120;
export type DurationHours = 1 | 2 | 3 | 4 | 6;

export interface SearchAmenitiesFilter {
  evOnly: boolean;
  coveredOnly: boolean;
  gatedOnly: boolean;
}

export interface SearchFilterItem {
  amenities: {
    evCharging: boolean;
    covered: boolean;
    securityLevel: string;
  };
}

export const ARRIVAL_OPTIONS: Array<{ offsetMinutes: ArrivalOffsetMinutes; label: string }> = [
  { offsetMinutes: 0, label: 'Now' },
  { offsetMinutes: 15, label: '+15m' },
  { offsetMinutes: 30, label: '+30m' },
  { offsetMinutes: 60, label: '+1h' },
  { offsetMinutes: 120, label: '+2h' },
];

export const DURATION_OPTIONS: DurationHours[] = [1, 2, 3, 4, 6];

export function computeArrivalIso(
  offsetMinutes: ArrivalOffsetMinutes,
  nowMs: number = Date.now(),
): string {
  const leadMinutes = Math.max(2, offsetMinutes);
  return new Date(nowMs + leadMinutes * 60_000).toISOString();
}

export function buildServerSearchFilters(
  amenities: SearchAmenitiesFilter,
  vehicleType?: VehiclePayloadType,
): Record<string, unknown> | undefined {
  const filters: Record<string, unknown> = {};
  if (amenities.evOnly) filters.evCharging = true;
  if (amenities.coveredOnly) filters.coveredParking = true;
  if (amenities.gatedOnly) filters.securityLevel = 'gated';
  if (vehicleType) filters.vehicleType = vehicleType;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function filterSpaceResults<T extends SearchFilterItem>(
  items: T[],
  amenities: SearchAmenitiesFilter,
): T[] {
  return items.filter((item) => {
    if (amenities.evOnly && !item.amenities.evCharging) return false;
    if (amenities.coveredOnly && !item.amenities.covered) return false;
    if (amenities.gatedOnly) {
      const level = (item.amenities.securityLevel || '').toLowerCase();
      if (!level || level === 'none' || level === 'low') return false;
    }
    return true;
  });
}

export function formatArrivalSummary(offsetMinutes: ArrivalOffsetMinutes): string {
  return offsetMinutes === 0 ? 'Arrive Now' : `In ${offsetMinutes >= 60 ? `${offsetMinutes / 60}h` : `${offsetMinutes}m`}`;
}

interface SearchSessionState {
  query: string;
  arrivalOffsetMinutes: ArrivalOffsetMinutes;
  durationHours: DurationHours;
  amenities: SearchAmenitiesFilter;
  matchDefaultVehicle: boolean;

  setQuery: (query: string) => void;
  setArrivalOffset: (offsetMinutes: ArrivalOffsetMinutes) => void;
  setDurationHours: (hours: DurationHours) => void;
  toggleAmenity: (key: keyof SearchAmenitiesFilter) => void;
  setMatchDefaultVehicle: (enabled: boolean) => void;
  resetFilters: () => void;
}

const DEFAULT_AMENITIES: SearchAmenitiesFilter = {
  evOnly: false,
  coveredOnly: false,
  gatedOnly: false,
};

export const useSearchStore = create<SearchSessionState>((set) => ({
  query: '',
  arrivalOffsetMinutes: 0,
  durationHours: 2,
  amenities: { ...DEFAULT_AMENITIES },
  matchDefaultVehicle: true,

  setQuery: (query) => set({ query }),
  setArrivalOffset: (arrivalOffsetMinutes) => set({ arrivalOffsetMinutes }),
  setDurationHours: (durationHours) => set({ durationHours }),
  toggleAmenity: (key) =>
    set((state) => ({
      amenities: {
        ...state.amenities,
        [key]: !state.amenities[key],
      },
    })),
  setMatchDefaultVehicle: (matchDefaultVehicle) => set({ matchDefaultVehicle }),
  resetFilters: () =>
    set({
      arrivalOffsetMinutes: 0,
      durationHours: 2,
      amenities: { ...DEFAULT_AMENITIES },
      matchDefaultVehicle: true,
    }),
}));
