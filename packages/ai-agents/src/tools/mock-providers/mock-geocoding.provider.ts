import { Result, ok, err, AgentError } from '../../core';
import { IGeocodingTool, GeocodingResult } from '../interfaces/geocoding-tool.interface';
import { CHENNAI_LOCATIONS } from '../../fixtures/chennai-locations.fixture';
import { encodeGeohash } from '../utils/geohash';

export class MockGeocodingProvider implements IGeocodingTool {
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
