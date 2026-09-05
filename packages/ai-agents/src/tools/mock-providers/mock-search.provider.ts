import { Result, ok, AgentError } from '../../core';
import {
  ISearchServiceTool,
  SearchCandidateSpace,
  SearchQueryParams,
} from '../interfaces/search-service-tool.interface';
import { CHENNAI_LOCATIONS } from '../../fixtures/chennai-locations.fixture';

export class MockSearchServiceProvider implements ISearchServiceTool {
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

  public async searchSpaces(
    params: SearchQueryParams
  ): Promise<Result<SearchCandidateSpace[], AgentError>> {
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
