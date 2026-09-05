import { Result, AgentError } from '../../core';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  geohash: string;
  normalizedAddress: string;
  city: string;
  pincode: string;
  isWithinServiceBoundary: boolean;
}

export interface IGeocodingTool {
  geocode(rawAddress: string): Promise<Result<GeocodingResult, AgentError>>;
  reverseGeocode?(latitude: number, longitude: number): Promise<Result<string, AgentError>>;
}
