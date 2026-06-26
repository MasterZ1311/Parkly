// ============================================================
// Search Service — Core Search Logic
// Geohash-based spatial search with filtering and ranking.
// ============================================================

import { PrismaClient, ParkingSpace } from '@prisma/client';

import {
  SearchQuery,
  SearchResponse,
  ParkingSpaceResult,
  FilterSet,
  Coordinates,
  haversineDistanceKm,
  formatDistance,
  encodeGeohash,
  getGeohashNeighbors,
  ValidationError,
  GeoError,
  getServiceClient,
} from '@parkly/shared';
import axios from 'axios';
import { getConfig } from '@parkly/shared';

const prisma = new PrismaClient();

const DEFAULT_RADIUS_KM = 2;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_ARRIVAL_OFFSET = 0; // use current time
const DEFAULT_DURATION_MINUTES = 60;
const GEOHASH_PRECISION = 6; // ~1.2km cells

// Ranking weights
const W_PROXIMITY = 0.35;
const W_AVAILABILITY = 0.35;
const W_PRICE = 0.15;
const W_CONFIDENCE = 0.15;

export interface SearchInput extends SearchQuery {}

export class SearchService {
  async search(query: SearchInput): Promise<SearchResponse> {
    const appliedDefaults: string[] = [];

    // --- Validate and resolve location ---
    let coords: Coordinates;
    if (query.location.type === 'coordinates') {
      coords = { lat: query.location.lat, lng: query.location.lng };
    } else if (query.location.type === 'text') {
      coords = await this.geocode(query.location.value);
    } else {
      throw new ValidationError('currentLocation not supported in server-side search. Provide coordinates.');
    }

    // --- Validate arrival time ---
    const arrivalTime = query.arrivalTime
      ? new Date(query.arrivalTime)
      : (appliedDefaults.push('arrivalTime'), new Date());

    const now = new Date();
    const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (arrivalTime < now) throw new ValidationError('arrivalTime must be in the future', 'arrivalTime');
    if (arrivalTime > maxTime) throw new ValidationError('arrivalTime must be within 7 days', 'arrivalTime');

    // --- Validate duration ---
    const duration = query.duration !== undefined
      ? query.duration
      : (appliedDefaults.push('duration'), DEFAULT_DURATION_MINUTES);

    if (duration < 15 || duration > 4320) {
      throw new ValidationError('duration must be between 15 and 4320 minutes', 'duration');
    }

    // --- Radius ---
    const radius = query.radius ?? (appliedDefaults.push('radius'), DEFAULT_RADIUS_KM);
    if (radius < 0.5 || radius > 50) {
      throw new ValidationError('radius must be between 0.5 and 50 km', 'radius');
    }

    // --- Pagination ---
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 5), 100);

    // --- Spatial query using geohash ---
    // Stored geohashes are precision-6; we prefilter on the 5-char prefix
    // cell plus its 8 neighbours so candidates near a cell boundary are not
    // missed. The haversine distance filter below is the authoritative gate.
    const centerGeohash = encodeGeohash(coords.lat, coords.lng, GEOHASH_PRECISION);
    const prefixCells = getGeohashNeighbors(centerGeohash.slice(0, 5)); // ~5km cells

    const spaces = await prisma.parkingSpace.findMany({
      where: {
        status: 'active',
        OR: prefixCells.map((cell) => ({ geohash: { startsWith: cell } })),
      },
      take: 500, // max candidates before filtering
    });

    // --- Distance filter ---
    const candidates = spaces.filter((space: ParkingSpace) => {
      const dist = haversineDistanceKm(
        coords.lat, coords.lng,
        Number(space.latitude), Number(space.longitude),
      );
      return dist <= radius;
    });


    // --- Apply filters ---
    const filtered = this.applyFilters(candidates, query.filters);

    // --- Get predictions (graceful degradation with circuit breaker) ---
    let predictions: Map<string, {
      probabilityPercent: number;
      estimatedVacancies: number;
      confidencePercent: number;
      insufficientData: boolean;
    }> = new Map();
    let predictionStatus: 'available' | 'unavailable' | 'degraded' = 'unavailable';

    try {
      const predictionClient = getServiceClient(
        'prediction-service',
        process.env['PREDICTION_URL'] || 'http://localhost:4005',
        { requestTimeout: 2000, failureThreshold: 3, resetTimeout: 15000 },
      );

      const response = await predictionClient.get<{ success: boolean; data: { predictions: Record<string, unknown> } }>(
        '/predict',
        {
          spaceIds: filtered.map(s => s.id).join(','),
          arrivalTime: arrivalTime.toISOString(),
          duration,
        },
      );

      const data = response.data?.data?.predictions || {};
      Object.entries(data).forEach(([spaceId, pred]) => {
        predictions.set(spaceId, pred as typeof predictions extends Map<string, infer V> ? V : never);
      });
      predictionStatus = 'available';
    } catch (_err) {
      predictionStatus = 'unavailable';
    }

    // --- Rank results ---
    const maxPrice = Math.max(...filtered.map(s => Number(s.hourlyRate)), 1);
    const ranked = filtered.map((space: ParkingSpace) => {
      const dist = haversineDistanceKm(coords.lat, coords.lng, Number(space.latitude), Number(space.longitude));
      const pred = predictions.get(space.id) || {
        probabilityPercent: predictionStatus === 'unavailable' ? 50 : 0,
        estimatedVacancies: 1,
        confidencePercent: predictionStatus === 'unavailable' ? 0 : 0,
        insufficientData: true,
      };

      const normProximity = 1 - Math.min(dist / radius, 1);
      const normAvailability = pred.probabilityPercent / 100;
      const normPrice = 1 - Math.min(Number(space.hourlyRate) / maxPrice, 1);
      const normConfidence = pred.confidencePercent / 100;

      const rankScore =
        W_PROXIMITY * normProximity +
        W_AVAILABILITY * normAvailability +
        W_PRICE * normPrice +
        W_CONFIDENCE * normConfidence;

      const { value: distValue, unit: distUnit } = formatDistance(dist);

      return {
        id: space.id,
        name: space.name,
        address: space.address,
        coordinates: { lat: Number(space.latitude), lng: Number(space.longitude) },
        distance: { value: distValue, unit: distUnit },
        price: { value: Number(space.hourlyRate), currency: 'INR' as const, per: 'hour' as const },
        availability: pred,
        amenities: {
          evCharging: space.evCharging,
          covered: space.covered,
          securityLevel: space.securityLevel as ParkingSpaceResult['amenities']['securityLevel'],
          accessibility: space.accessibility as ParkingSpaceResult['amenities']['accessibility'],
          vehicleTypes: space.vehicleTypes as ParkingSpaceResult['amenities']['vehicleTypes'],
        },
        rankScore,
        photoUrls: space.photoUrls,
      } as ParkingSpaceResult & { rankScore: number };
    });

    ranked.sort((a, b) => b.rankScore - a.rankScore);

    // --- Paginate ---
    const total = ranked.length;
    const paginated = ranked.slice((page - 1) * pageSize, page * pageSize);

    return {
      version: '1.0',
      results: paginated,
      pagination: {
        page,
        pageSize,
        totalResults: total,
        totalPages: Math.ceil(total / pageSize),
      },
      meta: {
        predictionStatus,
        searchRadiusKm: radius,
        appliedDefaults,
      },
    };
  }

  private async geocode(text: string): Promise<Coordinates> {
    const config = getConfig();
    const key = text.toLowerCase().trim();
    // Known Chennai areas — also used as a dev fallback when no/invalid Maps key.
    const mockLocations: Record<string, Coordinates> = {
      default: { lat: 13.0827, lng: 80.2707 }, // Chennai
      't nagar': { lat: 13.0418, lng: 80.2341 },
      'anna nagar': { lat: 13.0849, lng: 80.2101 },
      'adyar': { lat: 13.0067, lng: 80.2566 },
      'velachery': { lat: 12.9791, lng: 80.2204 },
    };

    if (!config.googleMapsApiKey || config.googleMapsApiKey === 'replace-with-google-maps-api-key') {
      return mockLocations[key] || mockLocations['default']!;
    }

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: { address: text, key: config.googleMapsApiKey },
          timeout: 3000,
        },
      );

      const results = response.data?.results;
      if (results && results.length > 0) {
        const location = results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      }
    } catch (_err) {
      // Fall through to local fallback below if the external API is unreachable.
    }

    // Graceful degradation: use a known local area if we recognise it, otherwise
    // surface a GeoError with a helpful suggestion.
    if (mockLocations[key]) return mockLocations[key]!;
    throw new GeoError(`Could not resolve location: "${text}"`, [
      { text: 'Chennai, Tamil Nadu', coordinates: { lat: 13.0827, lng: 80.2707 } },
    ]);
  }

  private applyFilters(spaces: ParkingSpace[], filters?: FilterSet): ParkingSpace[] {
    if (!filters) return spaces;

    return spaces.filter((space: ParkingSpace) => {
      if (filters.priceRange) {
        const rate = Number(space['hourlyRate']);
        if (rate < filters.priceRange.min || rate > filters.priceRange.max) return false;
      }
      if (filters.vehicleType) {
        const types = space['vehicleTypes'] as string[];
        if (!types.includes(filters.vehicleType)) return false;
      }
      if (filters.evCharging === true && !space['evCharging']) return false;
      if (filters.coveredParking === true && !space['covered']) return false;
      if (filters.securityLevel) {
        const levels = ['none', 'basic', 'monitored', 'staffed', 'gated'];
        if (levels.indexOf(space['securityLevel'] as string) < levels.indexOf(filters.securityLevel)) return false;
      }
      if (filters.accessibility?.length) {
        const spaceAccess = space.accessibility as string[];
        if (!filters.accessibility.every(a => spaceAccess.includes(a))) return false;
      }
      return true;
    });
  }
}

export const searchService = new SearchService();
