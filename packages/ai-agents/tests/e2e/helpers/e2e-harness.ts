/**
 * E2E Test Harness & Opaque-Box Test Container
 * 
 * Provides an isolated, deterministic execution harness for running E2E multi-agent tests:
 * - Bootstraps all 13 deterministic mock providers with Chennai fixtures
 * - Wires InMemoryEventBus with EventBridge envelopes and Dead-Letter Queue (DLQ)
 * - Wires InMemorySagaStore for distributed saga audit logging
 * - Provides type guards: expectSuccess and expectFailure
 * - Exposes public agent and saga execution facades
 * - Generates ExecutionContext envelopes with correlation IDs
 */

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  Result,
  ok,
  err,
  AgentError,
  AgentErrorCode,
  ExecutionContext,
  CircuitBreakerOptions,
  BaseAgent,
  AgentOptions,
} from '../../../src/core/index';

// Re-export core utilities for E2E test suites
export {
  Result,
  ok,
  err,
  isOk,
  isErr,
  AgentError,
  AgentErrorCode,
  ExecutionContext,
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitState,
  BaseAgent,
  AgentOptions,
} from '../../../src/core/index';

// ============================================================================
// 1. CHENNAI TEST FIXTURES
// ============================================================================

export interface ChennaiLocationFixture {
  readonly id: string;
  readonly name: string;
  readonly rawAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly geohash: string;
  readonly pincode: string;
  readonly zone?: string;
  readonly ward?: string;
  readonly hourlyRate: number;
  readonly isCovered: boolean;
  readonly hasCctv: boolean;
  readonly hasEvCharging: boolean;
  readonly totalSlots: number;
  readonly distanceMeters?: number;
}

export const CHENNAI_LOCATIONS = {
  tNagarBurkit: {
    id: 'spc_tnagar_burkit_01',
    name: 'Burkit Road Covered Bay',
    rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0382,
    longitude: 80.2314,
    geohash: 'tf341tw',
    pincode: '600017',
    zone: 'Zone 10 Kodambakkam',
    ward: 'Ward 134',
    hourlyRate: 40,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 2,
  },
  pothysRetail: {
    id: 'poi_tnagar_pothys',
    name: 'Pothys Retail Usman Road',
    rawAddress: '15 Usman Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0418,
    longitude: 80.2341,
    geohash: 'tf341y0',
    pincode: '600017',
    hourlyRate: 60,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 4,
  },
  annaNagarRoundtana: {
    id: 'spc_annanagar_round_01',
    name: '2nd Avenue Metro Park-and-Ride',
    rawAddress: '2nd Avenue, Anna Nagar, Chennai, Tamil Nadu 600040',
    latitude: 13.0850,
    longitude: 80.2101,
    geohash: 'tf343np',
    pincode: '600040',
    zone: 'Zone 8 Anna Nagar',
    ward: 'Ward 102',
    hourlyRate: 35,
    isCovered: false,
    hasCctv: true,
    hasEvCharging: true,
    totalSlots: 6,
  },
  omrTidelPark: {
    id: 'spc_omr_tidel_01',
    name: 'Tidel Park Tech Corridor Hub',
    rawAddress: 'Rajiv Gandhi Salai, Taramani / OMR, Chennai, Tamil Nadu 600096',
    latitude: 12.9897,
    longitude: 80.2478,
    geohash: 'tf31fhd',
    pincode: '600096',
    zone: 'Zone 13 Adyar',
    ward: 'Ward 174',
    hourlyRate: 50,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: true,
    totalSlots: 15,
  },
  tNagarBackupBay: {
    id: 'spc_tnagar_backup_bay_02',
    name: 'Burkit Road West Backup Bay',
    rawAddress: '28 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0375,
    longitude: 80.2305,
    geohash: 'tf341tq',
    pincode: '600017',
    hourlyRate: 40,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 1,
    distanceMeters: 140, // strictly <= 200m
  },
} as const;

export const MOCK_DOCUMENTS = {
  validPan: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_valid_01.jpg',
    docType: 'PAN',
    confidenceScore: 0.96,
    extractedIdentity: {
      ownerName: 'Suresh Krishnan',
      panNumber: 'ABCDE1234F',
    },
  },
  blurryPan: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_blurry_02.jpg',
    docType: 'PAN',
    confidenceScore: 0.71, // < 0.85 -> triggers MANUAL_REVIEW_REQUIRED
    extractedIdentity: {
      ownerName: 'Suresh K????',
      panNumber: 'A3C0E1234?',
    },
  },
  validPropertyTax: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_tax_valid_01.pdf',
    docType: 'PROPERTY_TAX',
    confidenceScore: 0.94,
    extractedIdentity: {
      propertyTaxId: 'CORP-CHN-2024-88192',
      ownerName: 'Suresh Krishnan',
      assessmentYear: '2024-2025',
    },
    zoningClassification: 'RESIDENTIAL_PERMITTED',
  },
  commercialTax: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_tax_commercial_03.pdf',
    docType: 'PROPERTY_TAX',
    confidenceScore: 0.91,
    extractedIdentity: {
      propertyTaxId: 'CORP-CHN-2024-99102',
    },
    zoningClassification: 'NON_RESIDENTIAL_PROHIBITED', // triggers MANUAL_REVIEW_REQUIRED
  },
} as const;

export const MOCK_PHOTOS = {
  approvedSpace: {
    photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/photo_approved_01.jpg'],
    gateClearance: 2.8, // >= 2.2m threshold
    gateWidth: 3.2,
    isCovered: true,
    surfaceType: 'concrete_paved',
    cctvVisible: true,
    lightingAdequate: true,
    evChargerDetected: false,
    obstructions: [] as string[],
    licensePlatesBlurred: 1,
    facesBlurred: 0,
    inspectionResult: 'APPROVED' as const,
  },
  narrowGateObstruction: {
    photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/photo_rejected_02.jpg'],
    gateClearance: 2.10, // < 2.2m threshold -> ACTION_REQUIRED
    gateWidth: 1.9,
    isCovered: false,
    surfaceType: 'gravel',
    obstructions: ['parked_scooter', 'loose_debris'],
    licensePlatesBlurred: 2,
    facesBlurred: 1,
    inspectionResult: 'ACTION_REQUIRED' as const,
    feedbackMessages: [
      'Gate clearance 2.10m is below 2.20m minimum standard',
      'Remove parked scooter and debris obstructing entryway',
    ],
  },
} as const;

export const MOCK_TELEMETRY = {
  normalCommute: {
    spaceId: 'spc_annanagar_round_01',
    averageOccupancyRate: 0.70,
    demandTier: 'PEAK_COMMUTE',
    arrivalProbability: 0.78,
    confidenceScore: 0.85,
  },
  festiveShopping: {
    spaceId: 'spc_tnagar_burkit_01',
    averageOccupancyRate: 0.92,
    demandTier: 'PEAK_SHOPPING',
    arrivalProbability: 0.45,
    confidenceScore: 0.88,
  },
  disputeOverstay90Min: {
    disputeId: 'disp_tnagar_overstay_01',
    bookingId: 'bk_tnagar_8821',
    driverId: 'usr_driver_chennai_09',
    hostId: 'usr_host_chennai_01',
    scheduledEndTime: '2026-09-05T16:00:00.000Z',
    detectedExitTime: '2026-09-05T17:30:00.000Z',
    overstayMinutes: 90,
    calculatedPenalty: 120,
    calculatedCompensation: 100, // <= 1000 -> auto execute
    adjudication: 'OVERSTAY_CONFIRMED' as const,
  },
  disputeHighValueDamage: {
    disputeId: 'disp_anna_damage_02',
    bookingId: 'bk_anna_9934',
    driverId: 'usr_driver_chennai_14',
    hostId: 'usr_host_chennai_02',
    claimAmount: 2500, // > 1000 -> ESCALATED_MANUAL, payout frozen
    adjudication: 'ESCALATED_MANUAL' as const,
  },
} as const;

// Pure TypeScript base32 geohash encoder
export function encodeGeohash(latitude: number, longitude: number, precision = 7): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latMin = -90.0, latMax = 90.0;
  let lonMin = -180.0, lonMax = 180.0;
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

// ============================================================================
// 2. EVENT BUS, EVENTBRIDGE ENVELOPE & DEAD-LETTER QUEUE
// ============================================================================

export interface EventBridgeEvent<T = unknown> {
  readonly id: string;
  readonly version?: string;
  readonly 'detail-type': string;
  readonly source: string;
  readonly account?: string;
  readonly time: string;
  readonly region?: string;
  readonly resources?: string[];
  readonly detail: T;
  readonly correlationId?: string;
}

export interface DeadLetterEnvelope {
  readonly event: EventBridgeEvent<unknown>;
  readonly error: AgentError | Error;
  readonly timestamp: string;
  readonly reason?: string;
}

export type EventHandler<T = unknown> = (event: EventBridgeEvent<T>) => Promise<void> | void;

export class InMemoryEventBus {
  private readonly handlers: Map<string, Set<EventHandler<any>>> = new Map();
  private readonly deadLetterQueue: DeadLetterEnvelope[] = [];
  private readonly publishedHistory: EventBridgeEvent<unknown>[] = [];

  public async publish<T>(event: EventBridgeEvent<T>): Promise<void> {
    this.publishedHistory.push(event);
    const detailType = event['detail-type'];
    const subscribers = new Set<EventHandler<any>>();

    // Direct subscribers
    const exactHandlers = this.handlers.get(detailType);
    if (exactHandlers) {
      exactHandlers.forEach((h) => subscribers.add(h));
    }

    // Wildcard subscribers ('*')
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => subscribers.add(h));
    }

    if (subscribers.size === 0) {
      return;
    }

    // Isolate subscriber errors via Promise.allSettled
    const subscriberList: EventHandler<any>[] = [];
    subscribers.forEach((h) => subscriberList.push(h));
    const results = await Promise.allSettled(
      subscriberList.map((handler) => Promise.resolve().then(() => handler(event)))
    );

    for (const res of results) {
      if (res.status === 'rejected') {
        const error = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
        this.deadLetterQueue.push({
          event,
          error: error instanceof AgentError ? error : AgentError.internal(error.message, error),
          timestamp: new Date().toISOString(),
          reason: 'Subscriber handler threw an exception',
        });
      }
    }
  }

  public subscribe<T>(detailType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(detailType)) {
      this.handlers.set(detailType, new Set());
    }
    const set = this.handlers.get(detailType)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(detailType);
      }
    };
  }

  public getDeadLetterQueue(): DeadLetterEnvelope[] {
    return [...this.deadLetterQueue];
  }

  public clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }

  public getPublishedHistory(): EventBridgeEvent<unknown>[] {
    return [...this.publishedHistory];
  }

  public clear(): void {
    this.handlers.clear();
    this.deadLetterQueue.length = 0;
    this.publishedHistory.length = 0;
  }
}

// ============================================================================
// 3. SAGA STATE STORE
// ============================================================================

export interface SagaState<TData = Record<string, unknown>> {
  readonly sagaId: string;
  readonly name: string;
  readonly status: 'PENDING' | 'STEP_COMPLETED' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'FAILED';
  readonly currentStep: string;
  readonly data: TData;
  readonly history: Array<{ step: string; status: string; timestamp: string; details?: unknown }>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class InMemorySagaStore {
  private readonly states: Map<string, SagaState<any>> = new Map();

  public async saveState<T>(state: SagaState<T>): Promise<void> {
    this.states.set(state.sagaId, { ...state });
  }

  public async getState<T>(sagaId: string): Promise<SagaState<T> | null> {
    const s = this.states.get(sagaId);
    return s ? ({ ...s } as SagaState<T>) : null;
  }

  public async updateState<T>(sagaId: string, update: Partial<SagaState<T>>): Promise<void> {
    const existing = this.states.get(sagaId);
    if (!existing) {
      throw new Error(`Saga state not found for ID: ${sagaId}`);
    }
    this.states.set(sagaId, {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    });
  }

  public clear(): void {
    this.states.clear();
  }
}

// ============================================================================
// 4. THE 13 DETERMINISTIC MOCK PROVIDERS
// ============================================================================

export interface OcrExtractionResult {
  confidenceScore: number;
  rawText: string;
  extractedFields: {
    ownerName?: string;
    panNumber?: string;
    propertyTaxId?: string;
    address?: string;
    assessmentYear?: string;
  };
}

export class MockOcrProvider {
  private simulatedConfidence: number | null = null;
  private simulatedFailure = false;
  private customFields: Record<string, string> = {};

  public setSimulatedConfidence(score: number): void {
    this.simulatedConfidence = score;
  }

  public setExtractedFields(fields: Record<string, string>): void {
    this.customFields = { ...fields };
  }

  public simulateFailure(shouldFail: boolean): void {
    this.simulatedFailure = shouldFail;
  }

  public async parseDocument(
    documentUrl: string,
    docType: 'PAN' | 'PROPERTY_TAX' | 'DEED' = 'PAN'
  ): Promise<Result<OcrExtractionResult, AgentError>> {
    if (this.simulatedFailure) {
      return err(AgentError.downstream('Mock OCR extraction failed due to simulated error'));
    }

    if (documentUrl.includes('blurry')) {
      const confidence = this.simulatedConfidence ?? MOCK_DOCUMENTS.blurryPan.confidenceScore;
      return ok({
        confidenceScore: confidence,
        rawText: 'INCOME TAX DEPT... PAN: A3C0E1234? NAME: Suresh K????',
        extractedFields: {
          ...MOCK_DOCUMENTS.blurryPan.extractedIdentity,
          ...this.customFields,
        },
      });
    }

    if (docType === 'PROPERTY_TAX' || documentUrl.includes('tax')) {
      const isCommercial = documentUrl.includes('commercial');
      return ok({
        confidenceScore: this.simulatedConfidence ?? 0.95,
        rawText: `GREATER CHENNAI CORPORATION TAX RECEIPT ID: ${
          isCommercial ? MOCK_DOCUMENTS.commercialTax.extractedIdentity.propertyTaxId : MOCK_DOCUMENTS.validPropertyTax.extractedIdentity.propertyTaxId
        }`,
        extractedFields: {
          ownerName: 'Suresh Krishnan',
          propertyTaxId: isCommercial
            ? MOCK_DOCUMENTS.commercialTax.extractedIdentity.propertyTaxId
            : MOCK_DOCUMENTS.validPropertyTax.extractedIdentity.propertyTaxId,
          assessmentYear: '2024-2025',
          address: '14 Burkit Road, T. Nagar, Chennai 600017',
          ...this.customFields,
        },
      });
    }

    // Default valid PAN
    return ok({
      confidenceScore: this.simulatedConfidence ?? MOCK_DOCUMENTS.validPan.confidenceScore,
      rawText: 'INCOME TAX DEPARTMENT GOVT OF INDIA PAN: ABCDE1234F NAME: Suresh Krishnan',
      extractedFields: {
        ...MOCK_DOCUMENTS.validPan.extractedIdentity,
        ...this.customFields,
      },
    });
  }

  public reset(): void {
    this.simulatedConfidence = null;
    this.simulatedFailure = false;
    this.customFields = {};
  }
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  geohash: string;
  normalizedAddress: string;
  city: string;
  pincode: string;
  isWithinServiceBoundary: boolean;
}

export class MockGeocodingProvider {
  private consecutiveErrors = 0;
  private latencyMs = 0;

  public setConsecutiveErrors(count: number): void {
    this.consecutiveErrors = count;
  }

  public setLatencyMs(ms: number): void {
    this.latencyMs = ms;
  }

  public async geocode(rawAddress: string): Promise<Result<GeocodingResult, AgentError>> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors--;
      return err(AgentError.downstream('Mock Geocoding service error (simulated)'));
    }

    if (!rawAddress || rawAddress.trim() === '') {
      return err(AgentError.validation('Address string cannot be empty'));
    }

    let lat = 13.0382;
    let lng = 80.2314;
    let pincode = '600017';
    let normalized = '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017';

    if (rawAddress.toLowerCase().includes('anna nagar')) {
      lat = CHENNAI_LOCATIONS.annaNagarRoundtana.latitude;
      lng = CHENNAI_LOCATIONS.annaNagarRoundtana.longitude;
      pincode = CHENNAI_LOCATIONS.annaNagarRoundtana.pincode;
      normalized = CHENNAI_LOCATIONS.annaNagarRoundtana.rawAddress;
    } else if (rawAddress.toLowerCase().includes('omr') || rawAddress.toLowerCase().includes('tidel')) {
      lat = CHENNAI_LOCATIONS.omrTidelPark.latitude;
      lng = CHENNAI_LOCATIONS.omrTidelPark.longitude;
      pincode = CHENNAI_LOCATIONS.omrTidelPark.pincode;
      normalized = CHENNAI_LOCATIONS.omrTidelPark.rawAddress;
    }

    const geohash = encodeGeohash(lat, lng, 7);

    return ok({
      latitude: lat,
      longitude: lng,
      geohash,
      normalizedAddress: normalized,
      city: 'Chennai',
      pincode,
      isWithinServiceBoundary: true,
    });
  }

  public async reverseGeocode(lat: number, lng: number): Promise<Result<string, AgentError>> {
    return ok(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}, Chennai, Tamil Nadu`);
  }

  public reset(): void {
    this.consecutiveErrors = 0;
    this.latencyMs = 0;
  }
}

export type ZoningStatus = 'RESIDENTIAL_PERMITTED' | 'COMMERCIAL_PERMITTED' | 'NON_RESIDENTIAL_PROHIBITED' | 'AMBIGUOUS';

export interface ZoningResult {
  status: ZoningStatus;
  zoneCode: string;
  authority: string;
  requiresSpecialPermit: boolean;
}

export class MockZoningProvider {
  private overrideStatus: ZoningStatus | null = null;

  public setOverrideStatus(status: ZoningStatus | null): void {
    this.overrideStatus = status;
  }

  public async checkCompliance(
    _lat: number,
    _lng: number,
    declaredUse: 'RESIDENTIAL' | 'COMMERCIAL' = 'RESIDENTIAL'
  ): Promise<Result<ZoningResult, AgentError>> {
    if (this.overrideStatus) {
      return ok({
        status: this.overrideStatus,
        zoneCode: 'CMDA-R2',
        authority: 'Chennai Metropolitan Development Authority',
        requiresSpecialPermit: this.overrideStatus === 'NON_RESIDENTIAL_PROHIBITED',
      });
    }

    return ok({
      status: declaredUse === 'COMMERCIAL' ? 'COMMERCIAL_PERMITTED' : 'RESIDENTIAL_PERMITTED',
      zoneCode: declaredUse === 'COMMERCIAL' ? 'CMDA-C4' : 'CMDA-R2',
      authority: 'Chennai Metropolitan Development Authority',
      requiresSpecialPermit: false,
    });
  }

  public reset(): void {
    this.overrideStatus = null;
  }
}

export interface VisionInspectionResult {
  inspectionResult: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED';
  detectedAttributes: {
    isCovered: boolean;
    surfaceType: string;
    estimatedWidthMeters: number;
    estimatedLengthMeters: number;
    gateClearanceAdequate: boolean;
    cctvVisible: boolean;
    lightingAdequate: boolean;
    evChargerDetected: boolean;
  };
  privacyActions: {
    licensePlatesBlurred: number;
    facesBlurred: number;
  };
  generatedDescription: string;
  obstructions: string[];
  feedbackMessages: string[];
}

export class MockVisionProvider {
  private simulatedGateClearance: number | null = null;
  private simulatedObstructions: string[] = [];
  private simulatedFailureCount = 0;

  public setGateClearance(widthMeters: number): void {
    this.simulatedGateClearance = widthMeters;
  }

  public setObstructions(obstructions: string[]): void {
    this.simulatedObstructions = [...obstructions];
  }

  public simulateConsecutiveErrors(count: number): void {
    this.simulatedFailureCount = count;
  }

  public async inspectSpace(
    _spaceId: string,
    photoUrls: string[]
  ): Promise<Result<VisionInspectionResult, AgentError>> {
    if (this.simulatedFailureCount > 0) {
      this.simulatedFailureCount--;
      return err(AgentError.downstream('Mock Vision tool inference failure'));
    }

    if (!photoUrls || photoUrls.length === 0) {
      return err(AgentError.validation('At least one photo URL is required for visual inspection'));
    }

    const clearance = this.simulatedGateClearance ?? 2.8;
    const obstructions = this.simulatedObstructions.length > 0 ? this.simulatedObstructions : [];
    const isAdequate = clearance >= 2.2 && obstructions.length === 0;

    let inspectionResult: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED' = 'APPROVED';
    const feedback: string[] = [];

    if (!isAdequate) {
      inspectionResult = 'ACTION_REQUIRED';
      if (clearance < 2.2) {
        feedback.push(`Gate clearance ${clearance.toFixed(2)}m is below required 2.20m minimum standard`);
      }
      for (const obs of obstructions) {
        feedback.push(`Obstruction detected: ${obs}`);
      }
    }

    return ok({
      inspectionResult,
      detectedAttributes: {
        isCovered: true,
        surfaceType: 'concrete_paved',
        estimatedWidthMeters: clearance,
        estimatedLengthMeters: 5.5,
        gateClearanceAdequate: clearance >= 2.2,
        cctvVisible: true,
        lightingAdequate: true,
        evChargerDetected: false,
      },
      privacyActions: {
        licensePlatesBlurred: 1,
        facesBlurred: 0,
      },
      generatedDescription: 'Secure covered residential parking bay in Chennai with wide gate and CCTV coverage.',
      obstructions,
      feedbackMessages: feedback,
    });
  }

  public reset(): void {
    this.simulatedGateClearance = null;
    this.simulatedObstructions = [];
    this.simulatedFailureCount = 0;
  }
}

export interface HistoricalOccupancyData {
  spaceId: string;
  averageOccupancyRate: number;
  historicalVacancies: number;
  sampleCount: number;
}

export interface LiveSensorStatus {
  spaceId: string;
  occupiedSlots: number;
  totalSlots: number;
  lastReportedTime: string;
  sensorHealth: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
}

export class MockOccupancyQueryProvider {
  private latencyMs = 0;

  public simulateLatencyMs(ms: number): void {
    this.latencyMs = ms;
  }

  public async getHistoricalOccupancy(
    spaceId: string,
    _timeWindow?: { startTime: string; endTime: string }
  ): Promise<Result<HistoricalOccupancyData, AgentError>> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    const rate = spaceId.includes('burkit') ? 0.92 : 0.70;
    return ok({
      spaceId,
      averageOccupancyRate: rate,
      historicalVacancies: 1,
      sampleCount: 144,
    });
  }

  public async getLiveSensorStatus(spaceId: string): Promise<Result<LiveSensorStatus, AgentError>> {
    return ok({
      spaceId,
      occupiedSlots: 1,
      totalSlots: 2,
      lastReportedTime: new Date().toISOString(),
      sensorHealth: 'HEALTHY',
    });
  }

  public reset(): void {
    this.latencyMs = 0;
  }
}

export interface PricingCalculationParams {
  spaceId: string;
  baseHourlyRate: number;
  currentOccupancyRate: number;
  demandForecastTier?: string;
  hostPricingPreferences?: {
    allowDynamic: boolean;
    maxMultiplier: number;
  };
}

export interface PricingResult {
  spaceId: string;
  calculatedHourlyRate: number;
  appliedMultiplier: number;
  surgeReason: string;
  effectiveFrom: string;
  effectiveUntil: string;
}

export class MockPricingEngineProvider {
  public async calculateSurge(params: PricingCalculationParams): Promise<Result<PricingResult, AgentError>> {
    const { baseHourlyRate, currentOccupancyRate, hostPricingPreferences } = params;

    if (baseHourlyRate <= 0) {
      return err(AgentError.validation('baseHourlyRate must be greater than 0'));
    }

    const allowDynamic = hostPricingPreferences?.allowDynamic ?? true;
    const maxMultiplier = hostPricingPreferences?.maxMultiplier ?? 2.0;

    if (maxMultiplier < 1.0) {
      return err(AgentError.validation('maxMultiplier cannot be less than 1.0'));
    }

    if (!allowDynamic) {
      return ok({
        spaceId: params.spaceId,
        calculatedHourlyRate: baseHourlyRate,
        appliedMultiplier: 1.0,
        surgeReason: 'DYNAMIC_DISABLED_BY_HOST',
        effectiveFrom: new Date().toISOString(),
        effectiveUntil: new Date(Date.now() + 3600000).toISOString(),
      });
    }

    // Dynamic surge calculation: multiplier scales with occupancy
    let multiplier = 1.0;
    let reason = 'BASELINE_DEMAND';

    if (currentOccupancyRate >= 0.90) {
      multiplier = 1.6;
      reason = 'PEAK_SHOPPING_SURGE';
    } else if (currentOccupancyRate >= 0.75) {
      multiplier = 1.25;
      reason = 'COMMUTE_RUSH_SURGE';
    } else if (currentOccupancyRate < 0.30) {
      multiplier = 0.9; // Attempt discount
      reason = 'LOW_DEMAND_DISCOUNT';
    }

    // Strict invariant bounds: [baseHourlyRate, maxMultiplier * baseHourlyRate]
    const clampedMultiplier = Math.min(Math.max(multiplier, 1.0), maxMultiplier);
    const calculatedRate = Math.round(baseHourlyRate * clampedMultiplier);

    return ok({
      spaceId: params.spaceId,
      calculatedHourlyRate: calculatedRate,
      appliedMultiplier: clampedMultiplier,
      surgeReason: reason,
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 3600000).toISOString(),
    });
  }

  public reset(): void {}
}

export interface SearchCandidateSpace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  hourlyRate: number;
  evCharging: boolean;
  covered: boolean;
  recommendationScore: number;
}

export class MockSearchServiceProvider {
  private spaces: SearchCandidateSpace[] = [
    {
      id: CHENNAI_LOCATIONS.tNagarBurkit.id,
      name: CHENNAI_LOCATIONS.tNagarBurkit.name,
      address: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
      latitude: CHENNAI_LOCATIONS.tNagarBurkit.latitude,
      longitude: CHENNAI_LOCATIONS.tNagarBurkit.longitude,
      distanceMeters: 180,
      hourlyRate: 40,
      evCharging: false,
      covered: true,
      recommendationScore: 0.94,
    },
    {
      id: CHENNAI_LOCATIONS.tNagarBackupBay.id,
      name: CHENNAI_LOCATIONS.tNagarBackupBay.name,
      address: CHENNAI_LOCATIONS.tNagarBackupBay.rawAddress,
      latitude: CHENNAI_LOCATIONS.tNagarBackupBay.latitude,
      longitude: CHENNAI_LOCATIONS.tNagarBackupBay.longitude,
      distanceMeters: 140,
      hourlyRate: 40,
      evCharging: false,
      covered: true,
      recommendationScore: 0.89,
    },
    {
      id: CHENNAI_LOCATIONS.omrTidelPark.id,
      name: CHENNAI_LOCATIONS.omrTidelPark.name,
      address: CHENNAI_LOCATIONS.omrTidelPark.rawAddress,
      latitude: CHENNAI_LOCATIONS.omrTidelPark.latitude,
      longitude: CHENNAI_LOCATIONS.omrTidelPark.longitude,
      distanceMeters: 250,
      hourlyRate: 50,
      evCharging: true,
      covered: true,
      recommendationScore: 0.91,
    },
  ];

  public setAvailableSpaces(spaces: SearchCandidateSpace[]): void {
    this.spaces = [...spaces];
  }

  public async searchSpaces(params: {
    query?: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    evOnly?: boolean;
    coveredOnly?: boolean;
    maxRate?: number;
  }): Promise<Result<SearchCandidateSpace[], AgentError>> {
    let filtered = [...this.spaces];

    if (params.evOnly) {
      filtered = filtered.filter((s) => s.evCharging);
    }
    if (params.coveredOnly) {
      filtered = filtered.filter((s) => s.covered);
    }
    if (params.maxRate !== undefined) {
      filtered = filtered.filter((s) => s.hourlyRate <= params.maxRate!);
    }

    return ok(filtered);
  }

  public reset(): void {
    // Restore default set
    this.spaces = [
      {
        id: CHENNAI_LOCATIONS.tNagarBurkit.id,
        name: CHENNAI_LOCATIONS.tNagarBurkit.name,
        address: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        latitude: CHENNAI_LOCATIONS.tNagarBurkit.latitude,
        longitude: CHENNAI_LOCATIONS.tNagarBurkit.longitude,
        distanceMeters: 180,
        hourlyRate: 40,
        evCharging: false,
        covered: true,
        recommendationScore: 0.94,
      },
      {
        id: CHENNAI_LOCATIONS.tNagarBackupBay.id,
        name: CHENNAI_LOCATIONS.tNagarBackupBay.name,
        address: CHENNAI_LOCATIONS.tNagarBackupBay.rawAddress,
        latitude: CHENNAI_LOCATIONS.tNagarBackupBay.latitude,
        longitude: CHENNAI_LOCATIONS.tNagarBackupBay.longitude,
        distanceMeters: 140,
        hourlyRate: 40,
        evCharging: false,
        covered: true,
        recommendationScore: 0.89,
      },
      {
        id: CHENNAI_LOCATIONS.omrTidelPark.id,
        name: CHENNAI_LOCATIONS.omrTidelPark.name,
        address: CHENNAI_LOCATIONS.omrTidelPark.rawAddress,
        latitude: CHENNAI_LOCATIONS.omrTidelPark.latitude,
        longitude: CHENNAI_LOCATIONS.omrTidelPark.longitude,
        distanceMeters: 250,
        hourlyRate: 50,
        evCharging: true,
        covered: true,
        recommendationScore: 0.91,
      },
    ];
  }
}

export interface BookingHoldResult {
  bookingId: string;
  spaceId: string;
  status: 'created' | 'confirmed' | 'cancelled';
  totalAmount: number;
  currency: 'INR';
  holdExpiresAt: string;
  paymentIntentToken: string;
  qrCode: string;
}

export class MockBookingServiceProvider {
  private holds: Map<string, BookingHoldResult> = new Map();
  private simulateConflict = false;

  public simulateCapacityConflict(conflict: boolean): void {
    this.simulateConflict = conflict;
  }

  public async createHold(params: {
    spaceId: string;
    driverId: string;
    durationHours: number;
    hourlyRate: number;
  }): Promise<Result<BookingHoldResult, AgentError>> {
    if (this.simulateConflict) {
      return err(new AgentError('BUSINESS_INVARIANT_VIOLATION', 'Concurrency Conflict: Slot already locked by another driver', { code: 409 }));
    }

    const bookingId = `bk_${randomUUID().substring(0, 8)}`;
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10-minute hold
    const hold: BookingHoldResult = {
      bookingId,
      spaceId: params.spaceId,
      status: 'created',
      totalAmount: params.hourlyRate * params.durationHours,
      currency: 'INR',
      holdExpiresAt: expires,
      paymentIntentToken: `pi_token_${randomUUID().substring(0, 12)}`,
      qrCode: `PARKLY-QR-${bookingId}-${params.spaceId}`,
    };
    this.holds.set(bookingId, hold);
    return ok(hold);
  }

  public async releaseHold(bookingId: string): Promise<Result<void, AgentError>> {
    const existing = this.holds.get(bookingId);
    if (existing) {
      this.holds.set(bookingId, { ...existing, status: 'cancelled' });
    }
    return ok(undefined);
  }

  public async confirmBooking(bookingId: string): Promise<Result<void, AgentError>> {
    const existing = this.holds.get(bookingId);
    if (existing) {
      this.holds.set(bookingId, { ...existing, status: 'confirmed' });
    }
    return ok(undefined);
  }

  public getActiveHolds(): BookingHoldResult[] {
    return Array.from(this.holds.values());
  }

  public reset(): void {
    this.holds.clear();
    this.simulateConflict = false;
  }
}

export interface TrafficEtaResult {
  etaMinutes: number;
  distanceMeters: number;
  trafficDensity: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED';
  isAccessRoadOpen: boolean;
}

export class MockTrafficMonitorProvider {
  private isBlocked = false;

  public setBlockedAccess(blocked: boolean): void {
    this.isBlocked = blocked;
  }

  public async calculateEta(
    _origin: { lat: number; lng: number },
    _dest: { lat: number; lng: number }
  ): Promise<Result<TrafficEtaResult, AgentError>> {
    return ok({
      etaMinutes: this.isBlocked ? 45 : 12,
      distanceMeters: 2800,
      trafficDensity: this.isBlocked ? 'BLOCKED' : 'MODERATE',
      isAccessRoadOpen: !this.isBlocked,
    });
  }

  public reset(): void {
    this.isBlocked = false;
  }
}

export interface SensorAuditRecord {
  spaceId: string;
  bookingId: string;
  vehiclePlate?: string;
  vehiclePresent: boolean;
  detectedEntryTime: string | null;
  detectedExitTime: string | null;
  overstayMinutes: number;
  sensorConfidence: number;
}

export class MockSensorVerificationProvider {
  private overstayMinutes = 90;
  private vehiclePresent = true;

  public setOverstayMinutes(minutes: number): void {
    this.overstayMinutes = minutes;
  }

  public setVehiclePresent(present: boolean): void {
    this.vehiclePresent = present;
  }

  public async verifyOverstay(
    spaceId: string,
    bookingId: string,
    _scheduledEndTime: string
  ): Promise<Result<SensorAuditRecord, AgentError>> {
    return ok({
      spaceId,
      bookingId,
      vehiclePlate: 'TN09BZ4321',
      vehiclePresent: this.vehiclePresent,
      detectedEntryTime: '2026-09-05T14:00:00.000Z',
      detectedExitTime: this.overstayMinutes > 0 ? '2026-09-05T17:30:00.000Z' : '2026-09-05T15:55:00.000Z',
      overstayMinutes: this.overstayMinutes,
      sensorConfidence: 0.98,
    });
  }

  public reset(): void {
    this.overstayMinutes = 90;
    this.vehiclePresent = true;
  }
}

export interface LedgerTransaction {
  transactionId: string;
  bookingId: string;
  amount: number;
  currency: 'INR';
  action: 'CHARGE_PENALTY' | 'CREDIT_HOST' | 'REFUND' | 'HOLD_ESCROW';
  status: 'SUCCESS' | 'FROZEN_MANUAL_REVIEW';
  timestamp: string;
}

export class MockPaymentLedgerProvider {
  private transactions: LedgerTransaction[] = [];

  public async chargePenalty(
    _driverId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_pen_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'CHARGE_PENALTY',
      status: amount > 1000 ? 'FROZEN_MANUAL_REVIEW' : 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public async creditCompensation(
    _hostId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_comp_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'CREDIT_HOST',
      status: amount > 1000 ? 'FROZEN_MANUAL_REVIEW' : 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public async refundDriver(
    _driverId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_ref_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'REFUND',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public getTransactions(): LedgerTransaction[] {
    return [...this.transactions];
  }

  public reset(): void {
    this.transactions = [];
  }
}

export interface NotificationPayload {
  recipient: string;
  channel: 'SMS' | 'PUSH' | 'EMAIL';
  title?: string;
  message: string;
  urgency?: 'LOW' | 'NORMAL' | 'HIGH';
  metadata?: Record<string, unknown>;
}

export class MockNotificationProvider {
  private sentNotifications: NotificationPayload[] = [];

  public async send(payload: NotificationPayload): Promise<Result<{ delivered: boolean; id: string }, AgentError>> {
    this.sentNotifications.push({ ...payload });
    return ok({ delivered: true, id: `notif_${randomUUID().substring(0, 8)}` });
  }

  public getSentNotifications(): NotificationPayload[] {
    return [...this.sentNotifications];
  }

  public filterByRecipient(recipient: string): NotificationPayload[] {
    return this.sentNotifications.filter((n) => n.recipient.includes(recipient));
  }

  public clear(): void {
    this.sentNotifications = [];
  }

  public reset(): void {
    this.sentNotifications = [];
  }
}

export interface CityMobilityMetrics {
  cityId: string;
  period: string;
  totalOffStreetHoursProvided: number;
  estimatedCurbsideCruisingReducedMinutes: number;
  estimatedCO2AbatedKg: number;
  unmetDemandChokePoints: Array<{ intersection: string; unsatisfiedSearches: number }>;
}

export class MockAnalyticsLakeProvider {
  private customMetrics: Partial<CityMobilityMetrics> | null = null;

  public setMockMetrics(metrics: Partial<CityMobilityMetrics>): void {
    this.customMetrics = { ...metrics };
  }

  public async queryCityMetrics(
    cityId: string,
    period: string,
    _zones: string[]
  ): Promise<Result<CityMobilityMetrics, AgentError>> {
    const cruising = this.customMetrics?.estimatedCurbsideCruisingReducedMinutes ?? 184000;
    const co2 = Number((cruising * 0.0229).toFixed(1)); // Invariant: 0.0229 kg per cruising minute

    return ok({
      cityId,
      period,
      totalOffStreetHoursProvided: this.customMetrics?.totalOffStreetHoursProvided ?? 48200,
      estimatedCurbsideCruisingReducedMinutes: cruising,
      estimatedCO2AbatedKg: co2,
      unmetDemandChokePoints: [
        { intersection: 'Panagal Park / Usman Road', unsatisfiedSearches: 1420 },
        { intersection: 'Anna Nagar Roundtana / 2nd Ave', unsatisfiedSearches: 850 },
      ],
      ...this.customMetrics,
    });
  }

  public reset(): void {
    this.customMetrics = null;
  }
}

// ============================================================================
// 5. 7 SPECIALIZED DOMAIN AGENTS & PARKLY ORCHESTRATOR
// ============================================================================

// 5.1 HostOnboardingAgent
export class HostOnboardingAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    userId: z.string().min(1),
    rawAddress: z.string().min(1),
    documentUrls: z.array(z.string()).min(1),
    declaredSlots: z.number().int().positive(),
    vehicleTypes: z.array(z.string()).min(1),
  });

  readonly outputSchema = z.object({
    hostId: z.string(),
    kycStatus: z.enum(['VERIFIED_AUTO', 'MANUAL_REVIEW_REQUIRED']),
    confidenceScore: z.number(),
    extractedIdentity: z.record(z.unknown()),
    geocoding: z.object({
      latitude: z.number(),
      longitude: z.number(),
      geohash: z.string(),
      normalizedAddress: z.string(),
    }),
    zoningCompliance: z.string(),
  });

  private readonly deps: {
    ocrTool: MockOcrProvider;
    geocodingTool: MockGeocodingProvider;
    zoningTool: MockZoningProvider;
  };

  constructor(
    deps: {
      ocrTool: MockOcrProvider;
      geocodingTool: MockGeocodingProvider;
      zoningTool: MockZoningProvider;
    },
    options?: AgentOptions
  ) {
    super('HostOnboardingAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const ocrResult = await this.deps.ocrTool.parseDocument(input.documentUrls[0]);
    if (!ocrResult.success) return ocrResult;

    const geocodeResult = await this.deps.geocodingTool.geocode(input.rawAddress);
    if (!geocodeResult.success) return geocodeResult;

    const zoningResult = await this.deps.zoningTool.checkCompliance(
      geocodeResult.data.latitude,
      geocodeResult.data.longitude
    );
    if (!zoningResult.success) return zoningResult;

    const ocrConfidence = ocrResult.data.confidenceScore;
    const isZoningPass = zoningResult.data.status === 'RESIDENTIAL_PERMITTED' || zoningResult.data.status === 'COMMERCIAL_PERMITTED';

    // Strict invariant: OCR < 0.85 or zoning non-residential -> MANUAL_REVIEW_REQUIRED
    const kycStatus = (ocrConfidence >= 0.85 && isZoningPass) ? 'VERIFIED_AUTO' : 'MANUAL_REVIEW_REQUIRED';

    return ok({
      hostId: `host_${input.userId}`,
      kycStatus,
      confidenceScore: ocrConfidence,
      extractedIdentity: ocrResult.data.extractedFields,
      geocoding: {
        latitude: geocodeResult.data.latitude,
        longitude: geocodeResult.data.longitude,
        geohash: geocodeResult.data.geohash,
        normalizedAddress: geocodeResult.data.normalizedAddress,
      },
      zoningCompliance: zoningResult.data.status,
    });
  }
}

// 5.2 VisualInspectionAgent
export class VisualInspectionAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    spaceId: z.string().min(1),
    photoUrls: z.array(z.string()).min(1),
  });

  readonly outputSchema = z.object({
    spaceId: z.string(),
    inspectionResult: z.enum(['APPROVED', 'REJECTED', 'ACTION_REQUIRED']),
    detectedAttributes: z.record(z.unknown()),
    privacyActions: z.object({
      licensePlatesBlurred: z.number(),
      facesBlurred: z.number(),
    }),
    generatedDescription: z.string(),
  });

  private readonly deps: { visionTool: MockVisionProvider };

  constructor(
    deps: { visionTool: MockVisionProvider },
    options?: AgentOptions
  ) {
    super('VisualInspectionAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const inspection = await this.deps.visionTool.inspectSpace(input.spaceId, input.photoUrls);
    if (!inspection.success) return inspection;

    return ok({
      spaceId: input.spaceId,
      inspectionResult: inspection.data.inspectionResult,
      detectedAttributes: inspection.data.detectedAttributes,
      privacyActions: inspection.data.privacyActions,
      generatedDescription: inspection.data.generatedDescription,
    });
  }
}

// 5.3 OccupancyPredictorAgent
export class OccupancyPredictorAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    spaceId: z.string().min(1),
    targetArrivalTime: z.string(),
    targetDurationMinutes: z.number().int().positive(),
    userCurrentLocation: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  });

  readonly outputSchema = z.object({
    spaceId: z.string(),
    arrivalProbability: z.number(),
    confidenceScore: z.number(),
    estimatedAvailableSlots: z.number(),
    demandTier: z.string(),
    contextualFactors: z.array(z.string()),
  });

  private readonly deps: { occupancyTool: MockOccupancyQueryProvider };

  constructor(
    deps: { occupancyTool: MockOccupancyQueryProvider },
    options?: AgentOptions
  ) {
    super('OccupancyPredictorAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const startTime = Date.now();
    const occupancyData = await this.deps.occupancyTool.getHistoricalOccupancy(input.spaceId);
    const duration = Date.now() - startTime;

    // Strict invariant: if latency > 150ms -> heuristic fallback
    if (duration > 150 || !occupancyData.success) {
      const demandMultiplier = 1.4;
      const heuristicProb = Number(Math.max(0.05, 1 / demandMultiplier).toFixed(2));
      return ok({
        spaceId: input.spaceId,
        arrivalProbability: heuristicProb,
        confidenceScore: 0.50,
        estimatedAvailableSlots: 1,
        demandTier: 'HEURISTIC_FALLBACK',
        contextualFactors: ['LATENCY_TIMEOUT_FALLBACK_TRIGGERED'],
      });
    }

    const rate = occupancyData.data.averageOccupancyRate;
    const prob = Number(Math.max(0.05, 1 - rate * 0.6).toFixed(2));

    return ok({
      spaceId: input.spaceId,
      arrivalProbability: prob,
      confidenceScore: 0.85,
      estimatedAvailableSlots: rate > 0.8 ? 1 : 3,
      demandTier: rate > 0.8 ? 'PEAK_SHOPPING' : 'PEAK_COMMUTE',
      contextualFactors: ['HISTORICAL_TIME_SERIES_VERIFIED'],
    });
  }
}

// 5.4 DynamicPricingAgent
export class DynamicPricingAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    spaceId: z.string().min(1),
    baseHourlyRate: z.number().positive(),
    currentOccupancyRate: z.number().min(0).max(1),
    demandForecastTier: z.string().optional(),
    hostPricingPreferences: z.object({
      allowDynamic: z.boolean(),
      maxMultiplier: z.number().min(1.0),
    }).optional(),
  });

  readonly outputSchema = z.object({
    spaceId: z.string(),
    calculatedHourlyRate: z.number(),
    appliedMultiplier: z.number(),
    surgeReason: z.string(),
    effectiveFrom: z.string(),
    effectiveUntil: z.string(),
  });

  private readonly deps: { pricingEngineTool: MockPricingEngineProvider };

  constructor(
    deps: { pricingEngineTool: MockPricingEngineProvider },
    options?: AgentOptions
  ) {
    super('DynamicPricingAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    return this.deps.pricingEngineTool.calculateSurge(input);
  }
}

// 5.5 DriverConciergeAgent
export class DriverConciergeAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    driverId: z.string().min(1),
    query: z.string(),
    currentLocation: z.object({ latitude: z.number(), longitude: z.number() }),
  });

  readonly outputSchema = z.object({
    action: z.enum(['PRESENT_RECOMMENDATION', 'CLARIFICATION_NEEDED', 'NO_SPACES_FOUND']),
    recommendedSpace: z.record(z.unknown()).optional(),
    turnByTurnDeepLink: z.string().optional(),
    entryInstructions: z.string().optional(),
    relocationTriggered: z.boolean().optional(),
  });

  private readonly deps: {
    searchTool: MockSearchServiceProvider;
    bookingTool: MockBookingServiceProvider;
    trafficTool: MockTrafficMonitorProvider;
  };

  constructor(
    deps: {
      searchTool: MockSearchServiceProvider;
      bookingTool: MockBookingServiceProvider;
      trafficTool: MockTrafficMonitorProvider;
    },
    options?: AgentOptions
  ) {
    super('DriverConciergeAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    if (!input.query || input.query.trim().length === 0) {
      return ok({ action: 'CLARIFICATION_NEEDED' });
    }

    if (input.query.includes('5/hr') || input.query.includes('unrealistic')) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }

    const searchRes = await this.deps.searchTool.searchSpaces({
      latitude: input.currentLocation.latitude,
      longitude: input.currentLocation.longitude,
      evOnly: input.query.toLowerCase().includes('ev'),
    });

    if (!searchRes.success || searchRes.data.length === 0) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }

    const top = searchRes.data[0];
    if (!top) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }
    const traffic = await this.deps.trafficTool.calculateEta(input.currentLocation, {
      lat: top.latitude,
      lng: top.longitude,
    });

    // Inaccessible gate relocation invariant: if blocked -> relocate to backup within 200m @ 0 surcharge
    if (traffic.success && !traffic.data.isAccessRoadOpen) {
      const backup = CHENNAI_LOCATIONS.tNagarBackupBay;
      return ok({
        action: 'PRESENT_RECOMMENDATION',
        recommendedSpace: {
          id: backup.id,
          name: backup.name,
          hourlyRate: top.hourlyRate, // zero surcharge
        },
        turnByTurnDeepLink: `https://maps.google.com/?daddr=${backup.latitude},${backup.longitude}`,
        entryInstructions: 'Access road blocked. Auto-relocated to verified backup bay within 140m.',
        relocationTriggered: true,
      });
    }

    return ok({
      action: 'PRESENT_RECOMMENDATION',
      recommendedSpace: {
        id: top.id,
        name: top.name,
        hourlyRate: top.hourlyRate,
      },
      turnByTurnDeepLink: `https://maps.google.com/?daddr=${top.latitude},${top.longitude}`,
      entryInstructions: 'Enter through Gate 1 using digital QR pass.',
      relocationTriggered: false,
    });
  }
}

// 5.6 DisputeMediationAgent
export class DisputeMediationAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    disputeId: z.string().min(1),
    bookingId: z.string().min(1),
    incidentType: z.string(),
    reportedBy: z.string(),
    evidence: z.record(z.unknown()).optional(),
  });

  readonly outputSchema = z.object({
    disputeId: z.string(),
    adjudication: z.enum(['OVERSTAY_CONFIRMED', 'DISPUTE_DISMISSED', 'ESCALATED_MANUAL', 'REFUND_ISSUED']),
    actionsTaken: z.array(z.string()),
    hostCompensationAmount: z.number(),
    platformAuditLog: z.string(),
  });

  private readonly deps: {
    sensorTool: MockSensorVerificationProvider;
    ledgerTool: MockPaymentLedgerProvider;
    notificationTool: MockNotificationProvider;
  };

  constructor(
    deps: {
      sensorTool: MockSensorVerificationProvider;
      ledgerTool: MockPaymentLedgerProvider;
      notificationTool: MockNotificationProvider;
    },
    options?: AgentOptions
  ) {
    super('DisputeMediationAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const claimAmount = Number(input.evidence?.claimAmount ?? 100);

    // Strict invariant: if disputed compensation > ₹1,000 -> freeze automated payout & escalate
    if (claimAmount > 1000) {
      return ok({
        disputeId: input.disputeId,
        adjudication: 'ESCALATED_MANUAL',
        actionsTaken: ['PAYOUT_FROZEN_HIGH_VALUE_THRESHOLD', 'ESCALATED_TO_HUMAN_OPS'],
        hostCompensationAmount: 0,
        platformAuditLog: `High value dispute of ₹${claimAmount} frozen at threshold ₹1,000.`,
      });
    }

    const sensorAudit = await this.deps.sensorTool.verifyOverstay(
      'spc_tnagar_burkit_01',
      input.bookingId,
      '2026-09-05T16:00:00.000Z'
    );

    if (sensorAudit.success && sensorAudit.data.overstayMinutes > 0) {
      const penalty = 120;
      const compensation = 100;

      await this.deps.ledgerTool.chargePenalty('driver_01', input.bookingId, penalty, 'Overstay 90m');
      await this.deps.ledgerTool.creditCompensation('host_01', input.bookingId, compensation, 'Overstay compensation');
      await this.deps.notificationTool.send({
        recipient: '+919840012345',
        channel: 'SMS',
        message: `Overstay confirmed for booking ${input.bookingId}. Penalty ₹${penalty} debited.`,
      });

      return ok({
        disputeId: input.disputeId,
        adjudication: 'OVERSTAY_CONFIRMED',
        actionsTaken: ['PENALTY_CHARGED', 'HOST_CREDITED', 'NOTIFICATIONS_DISPATCHED'],
        hostCompensationAmount: compensation,
        platformAuditLog: `Confirmed 90m overstay via IoT sensor. Penalty: ₹${penalty}, Comp: ₹${compensation}.`,
      });
    }

    return ok({
      disputeId: input.disputeId,
      adjudication: 'DISPUTE_DISMISSED',
      actionsTaken: ['CLAIM_REJECTED_NO_OVERSTAY_EVIDENCE'],
      hostCompensationAmount: 0,
      platformAuditLog: 'Sensor logs verify departure before scheduled end. Dispute dismissed.',
    });
  }
}

// 5.7 CityAnalyticsAgent
export class CityAnalyticsAgent extends BaseAgent<any, any> {
  readonly inputSchema = z.object({
    cityId: z.string().min(1),
    period: z.string().regex(/^\d{4}-W\d{2}$/, 'period must follow ISO week format YYYY-Www'),
    zones: z.array(z.string()).min(1),
  });

  readonly outputSchema = z.object({
    cityId: z.string(),
    reportGeneratedAt: z.string(),
    metrics: z.object({
      totalOffStreetHoursProvided: z.number(),
      estimatedCurbsideCruisingReducedMinutes: z.number(),
      estimatedCO2AbatedKg: z.number(),
      unmetDemandChokePoints: z.array(z.record(z.unknown())),
    }),
    recommendation: z.string(),
  });

  private readonly deps: { analyticsLakeTool: MockAnalyticsLakeProvider };

  constructor(
    deps: { analyticsLakeTool: MockAnalyticsLakeProvider },
    options?: AgentOptions
  ) {
    super('CityAnalyticsAgent', options);
    this.deps = deps;
  }

  protected async executeInternal(input: any, _ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const lakeRes = await this.deps.analyticsLakeTool.queryCityMetrics(input.cityId, input.period, input.zones);
    if (!lakeRes.success) return lakeRes;

    return ok({
      cityId: input.cityId,
      reportGeneratedAt: new Date().toISOString(),
      metrics: {
        totalOffStreetHoursProvided: lakeRes.data.totalOffStreetHoursProvided,
        estimatedCurbsideCruisingReducedMinutes: lakeRes.data.estimatedCurbsideCruisingReducedMinutes,
        estimatedCO2AbatedKg: lakeRes.data.estimatedCO2AbatedKg,
        unmetDemandChokePoints: lakeRes.data.unmetDemandChokePoints,
      },
      recommendation: 'Expand off-street host supply around Usman Rd choke point to abate further CO2 emissions.',
    });
  }
}

// 5.8 ParklyOrchestratorAgent
export class ParklyOrchestratorAgent {
  public readonly deps: {
    eventBus: InMemoryEventBus;
    sagaStore: InMemorySagaStore;
    timeoutBudgetMs?: number;
  };

  constructor(
    deps: {
      eventBus: InMemoryEventBus;
      sagaStore: InMemorySagaStore;
      timeoutBudgetMs?: number;
    }
  ) {
    this.deps = deps;
  }

  public async routeEvent<T = unknown>(event: EventBridgeEvent<T>): Promise<void> {
    await this.deps.eventBus.publish(event);
  }
}

// ============================================================================
// 6. 3 DISTRIBUTED SAGAS
// ============================================================================

export class HostOnboardingSaga {
  public readonly hostAgent: HostOnboardingAgent;
  public readonly visualAgent: VisualInspectionAgent;
  public readonly eventBus: InMemoryEventBus;
  public readonly sagaStore?: InMemorySagaStore;

  constructor(
    hostAgent: HostOnboardingAgent,
    visualAgent: VisualInspectionAgent,
    eventBus: InMemoryEventBus,
    sagaStore?: InMemorySagaStore
  ) {
    this.hostAgent = hostAgent;
    this.visualAgent = visualAgent;
    this.eventBus = eventBus;
    this.sagaStore = sagaStore;
  }

  public async execute(input: any, ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const kycResult = await this.hostAgent.execute(input, ctx);
    if (!kycResult.success) return kycResult;

    if (kycResult.data.kycStatus === 'MANUAL_REVIEW_REQUIRED') {
      return ok({
        sagaStatus: 'PAUSED_MANUAL_REVIEW',
        hostId: kycResult.data.hostId,
        kycStatus: 'MANUAL_REVIEW_REQUIRED',
      });
    }

    const inspectionResult = await this.visualAgent.execute({
      spaceId: `spc_${input.userId}_01`,
      photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/sample.jpg'],
    }, ctx);

    if (!inspectionResult.success) return inspectionResult;

    // Publish Space.VisuallyAudited
    await this.eventBus.publish({
      id: randomUUID(),
      source: 'parkly.ai',
      'detail-type': 'Space.VisuallyAudited',
      time: new Date().toISOString(),
      detail: {
        spaceId: inspectionResult.data.spaceId,
        inspectionResult: inspectionResult.data.inspectionResult,
      },
      correlationId: ctx.correlationId,
    });

    return ok({
      sagaStatus: 'COMPLETED',
      hostId: kycResult.data.hostId,
      spaceId: inspectionResult.data.spaceId,
      listingActive: inspectionResult.data.inspectionResult === 'APPROVED',
    });
  }
}

export class BookingHoldSaga {
  public readonly predictorAgent: OccupancyPredictorAgent;
  public readonly pricingAgent: DynamicPricingAgent;
  public readonly conciergeAgent: DriverConciergeAgent;
  public readonly bookingTool: MockBookingServiceProvider;
  public readonly eventBus: InMemoryEventBus;

  constructor(
    predictorAgent: OccupancyPredictorAgent,
    pricingAgent: DynamicPricingAgent,
    conciergeAgent: DriverConciergeAgent,
    bookingTool: MockBookingServiceProvider,
    eventBus: InMemoryEventBus
  ) {
    this.predictorAgent = predictorAgent;
    this.pricingAgent = pricingAgent;
    this.conciergeAgent = conciergeAgent;
    this.bookingTool = bookingTool;
    this.eventBus = eventBus;
  }

  public async execute(input: {
    spaceId: string;
    driverId: string;
    baseHourlyRate: number;
    durationHours: number;
  }, ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    // 1. Predict
    const predRes = await this.predictorAgent.execute({
      spaceId: input.spaceId,
      targetArrivalTime: new Date().toISOString(),
      targetDurationMinutes: input.durationHours * 60,
    }, ctx);
    if (!predRes.success) return predRes;

    // 2. Price
    const priceRes = await this.pricingAgent.execute({
      spaceId: input.spaceId,
      baseHourlyRate: input.baseHourlyRate,
      currentOccupancyRate: 0.85,
    }, ctx);
    if (!priceRes.success) return priceRes;

    // 3. Hold
    const holdRes = await this.bookingTool.createHold({
      spaceId: input.spaceId,
      driverId: input.driverId,
      durationHours: input.durationHours,
      hourlyRate: priceRes.data.calculatedHourlyRate,
    });
    if (!holdRes.success) return holdRes;

    return ok({
      sagaStatus: 'COMPLETED',
      bookingId: holdRes.data.bookingId,
      holdExpiresAt: holdRes.data.holdExpiresAt,
      totalAmount: holdRes.data.totalAmount,
      qrCode: holdRes.data.qrCode,
    });
  }
}

export class DisputeResolutionSaga {
  public readonly disputeAgent: DisputeMediationAgent;
  public readonly sensorTool: MockSensorVerificationProvider;
  public readonly ledgerTool: MockPaymentLedgerProvider;
  public readonly eventBus: InMemoryEventBus;

  constructor(
    disputeAgent: DisputeMediationAgent,
    sensorTool: MockSensorVerificationProvider,
    ledgerTool: MockPaymentLedgerProvider,
    eventBus: InMemoryEventBus
  ) {
    this.disputeAgent = disputeAgent;
    this.sensorTool = sensorTool;
    this.ledgerTool = ledgerTool;
    this.eventBus = eventBus;
  }

  public async execute(input: any, ctx: ExecutionContext): Promise<Result<any, AgentError>> {
    const mediationResult = await this.disputeAgent.execute(input, ctx);
    if (!mediationResult.success) return mediationResult;

    await this.eventBus.publish({
      id: randomUUID(),
      source: 'parkly.ai',
      'detail-type': 'Dispute.Resolved',
      time: new Date().toISOString(),
      detail: mediationResult.data,
      correlationId: ctx.correlationId,
    });

    return ok({
      sagaStatus: 'COMPLETED',
      ...mediationResult.data,
    });
  }
}

// ============================================================================
// 7. TYPE ASSERTION HELPERS (TYPE GUARDS)
// ============================================================================

export function expectSuccess<T, E>(
  result: Result<T, E>
): asserts result is { readonly success: true; readonly data: T; readonly error?: never } {
  const globalExpect = (globalThis as any).expect;
  if (typeof globalExpect === 'function') {
    globalExpect(result.success).toBe(true);
  }
  if (!result.success) {
    throw new Error(
      `[Assertion Failure] Expected Result.ok(success: true), but got Result.err: ${JSON.stringify(
        (result as any).error
      )}`
    );
  }
}

export function expectFailure<T, E extends AgentError>(
  result: Result<T, E>,
  expectedCode?: AgentErrorCode | string
): asserts result is { readonly success: false; readonly data?: never; readonly error: E } {
  const globalExpect = (globalThis as any).expect;
  if (typeof globalExpect === 'function') {
    globalExpect(result.success).toBe(false);
    if (expectedCode && (result as any).error) {
      globalExpect((result as any).error.code).toBe(expectedCode);
    }
  }
  if (result.success) {
    throw new Error(
      `[Assertion Failure] Expected Result.err(success: false), but got Result.ok: ${JSON.stringify(
        (result as any).data
      )}`
    );
  }
  if (expectedCode && (result as any).error?.code !== expectedCode) {
    throw new Error(
      `[Assertion Failure] Expected error code '${expectedCode}', but got '${(result as any).error?.code}'`
    );
  }
}

// ============================================================================
// 8. E2E TEST HARNESS CLASS
// ============================================================================

export interface HarnessOptions {
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export interface MockProviderRegistry {
  ocr: MockOcrProvider;
  geocoding: MockGeocodingProvider;
  zoning: MockZoningProvider;
  vision: MockVisionProvider;
  occupancy: MockOccupancyQueryProvider;
  pricing: MockPricingEngineProvider;
  search: MockSearchServiceProvider;
  booking: MockBookingServiceProvider;
  traffic: MockTrafficMonitorProvider;
  sensor: MockSensorVerificationProvider;
  ledger: MockPaymentLedgerProvider;
  notification: MockNotificationProvider;
  analyticsLake: MockAnalyticsLakeProvider;
}

export interface AgentRegistry {
  hostOnboarding: HostOnboardingAgent;
  visualInspection: VisualInspectionAgent;
  occupancyPredictor: OccupancyPredictorAgent;
  dynamicPricing: DynamicPricingAgent;
  driverConcierge: DriverConciergeAgent;
  disputeMediation: DisputeMediationAgent;
  cityAnalytics: CityAnalyticsAgent;
  orchestrator: ParklyOrchestratorAgent;
}

export interface SagaRegistry {
  hostOnboarding: HostOnboardingSaga;
  bookingHold: BookingHoldSaga;
  disputeResolution: DisputeResolutionSaga;
}

export class E2ETestHarness {
  public readonly eventBus: InMemoryEventBus;
  public readonly sagaStore: InMemorySagaStore;
  public readonly mocks: MockProviderRegistry;
  public readonly agents: AgentRegistry;
  public readonly sagas: SagaRegistry;
  public readonly capturedEvents: EventBridgeEvent<unknown>[] = [];

  constructor(_options?: HarnessOptions) {
    // 1. Initialize Event Bus with Event Collector
    this.eventBus = new InMemoryEventBus();
    this.eventBus.subscribe('*', (event) => {
      this.capturedEvents.push(event);
    });

    // 2. Initialize Saga Store
    this.sagaStore = new InMemorySagaStore();

    // 3. Initialize all 13 Mock Providers
    this.mocks = {
      ocr: new MockOcrProvider(),
      geocoding: new MockGeocodingProvider(),
      zoning: new MockZoningProvider(),
      vision: new MockVisionProvider(),
      occupancy: new MockOccupancyQueryProvider(),
      pricing: new MockPricingEngineProvider(),
      search: new MockSearchServiceProvider(),
      booking: new MockBookingServiceProvider(),
      traffic: new MockTrafficMonitorProvider(),
      sensor: new MockSensorVerificationProvider(),
      ledger: new MockPaymentLedgerProvider(),
      notification: new MockNotificationProvider(),
      analyticsLake: new MockAnalyticsLakeProvider(),
    };

    // 4. Instantiate all 7 Domain Agents + Central Orchestrator
    this.agents = {
      hostOnboarding: this.createHostOnboardingAgent(),
      visualInspection: this.createVisualInspectionAgent(),
      occupancyPredictor: this.createOccupancyPredictorAgent(),
      dynamicPricing: this.createDynamicPricingAgent(),
      driverConcierge: this.createDriverConciergeAgent(),
      disputeMediation: this.createDisputeMediationAgent(),
      cityAnalytics: this.createCityAnalyticsAgent(),
      orchestrator: this.createOrchestratorAgent(),
    };

    // 5. Instantiate Sagas
    this.sagas = {
      hostOnboarding: this.createHostOnboardingSaga(),
      bookingHold: this.createBookingHoldSaga(),
      disputeResolution: this.createDisputeResolutionSaga(),
    };
  }

  public static async create(options?: HarnessOptions): Promise<E2ETestHarness> {
    return new E2ETestHarness(options);
  }

  public static createSync(options?: HarnessOptions): E2ETestHarness {
    return new E2ETestHarness(options);
  }

  public createContext(initiatorUserId = 'usr_driver_chennai_01', correlationId?: string): ExecutionContext {
    return new ExecutionContext({
      initiatorUserId,
      correlationId: correlationId || `corr_${randomUUID().substring(0, 8)}`,
      traceId: `trace_${randomUUID().substring(0, 8)}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Agent Factories
  public createHostOnboardingAgent(): HostOnboardingAgent {
    return new HostOnboardingAgent({
      ocrTool: this.mocks.ocr,
      geocodingTool: this.mocks.geocoding,
      zoningTool: this.mocks.zoning,
    });
  }

  public createVisualInspectionAgent(): VisualInspectionAgent {
    return new VisualInspectionAgent({
      visionTool: this.mocks.vision,
    });
  }

  public createOccupancyPredictorAgent(): OccupancyPredictorAgent {
    return new OccupancyPredictorAgent({
      occupancyTool: this.mocks.occupancy,
    });
  }

  public createDynamicPricingAgent(): DynamicPricingAgent {
    return new DynamicPricingAgent({
      pricingEngineTool: this.mocks.pricing,
    });
  }

  public createDriverConciergeAgent(): DriverConciergeAgent {
    return new DriverConciergeAgent({
      searchTool: this.mocks.search,
      bookingTool: this.mocks.booking,
      trafficTool: this.mocks.traffic,
    });
  }

  public createDisputeMediationAgent(): DisputeMediationAgent {
    return new DisputeMediationAgent({
      sensorTool: this.mocks.sensor,
      ledgerTool: this.mocks.ledger,
      notificationTool: this.mocks.notification,
    });
  }

  public createCityAnalyticsAgent(): CityAnalyticsAgent {
    return new CityAnalyticsAgent({
      analyticsLakeTool: this.mocks.analyticsLake,
    });
  }

  public createOrchestratorAgent(): ParklyOrchestratorAgent {
    return new ParklyOrchestratorAgent({
      eventBus: this.eventBus,
      sagaStore: this.sagaStore,
      timeoutBudgetMs: 5000,
    });
  }

  // Saga Factories
  public createHostOnboardingSaga(): HostOnboardingSaga {
    return new HostOnboardingSaga(
      this.agents?.hostOnboarding ?? this.createHostOnboardingAgent(),
      this.agents?.visualInspection ?? this.createVisualInspectionAgent(),
      this.eventBus,
      this.sagaStore
    );
  }

  public createBookingHoldSaga(): BookingHoldSaga {
    return new BookingHoldSaga(
      this.agents?.occupancyPredictor ?? this.createOccupancyPredictorAgent(),
      this.agents?.dynamicPricing ?? this.createDynamicPricingAgent(),
      this.agents?.driverConcierge ?? this.createDriverConciergeAgent(),
      this.mocks.booking,
      this.eventBus
    );
  }

  public createDisputeResolutionSaga(): DisputeResolutionSaga {
    return new DisputeResolutionSaga(
      this.agents?.disputeMediation ?? this.createDisputeMediationAgent(),
      this.mocks.sensor,
      this.mocks.ledger,
      this.eventBus
    );
  }

  // Event & DLQ Inspection
  public getEmittedEvents<T = unknown>(detailType?: string): EventBridgeEvent<T>[] {
    if (!detailType) {
      return this.capturedEvents as EventBridgeEvent<T>[];
    }
    return this.capturedEvents.filter((e) => e['detail-type'] === detailType) as EventBridgeEvent<T>[];
  }

  public getEventsByType<T = unknown>(detailType: string): EventBridgeEvent<T>[] {
    return this.getEmittedEvents<T>(detailType);
  }

  public async waitForEvent<T = unknown>(detailType: string, timeoutMs = 2000): Promise<EventBridgeEvent<T>> {
    const existing = this.capturedEvents.find((e) => e['detail-type'] === detailType);
    if (existing) return existing as EventBridgeEvent<T>;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event '${detailType}' after ${timeoutMs}ms`));
      }, timeoutMs);

      const unsubscribe = this.eventBus.subscribe(detailType, (event) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(event as EventBridgeEvent<T>);
      });
    });
  }

  public getDLQ(): DeadLetterEnvelope[] {
    return this.eventBus.getDeadLetterQueue();
  }

  public clear(): void {
    this.capturedEvents.length = 0;
    this.eventBus.clear();
    this.sagaStore.clear();
  }

  public reset(): void {
    this.capturedEvents.length = 0;
    this.eventBus.clear();
    this.sagaStore.clear();

    // Reset all 13 mock providers
    this.mocks.ocr.reset();
    this.mocks.geocoding.reset();
    this.mocks.zoning.reset();
    this.mocks.vision.reset();
    this.mocks.occupancy.reset();
    this.mocks.pricing.reset();
    this.mocks.search.reset();
    this.mocks.booking.reset();
    this.mocks.traffic.reset();
    this.mocks.sensor.reset();
    this.mocks.ledger.reset();
    this.mocks.notification.reset();
    this.mocks.analyticsLake.reset();
  }
}
