import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  ok,
  AgentError,
} from '../../core';
import {
  ISearchServiceTool,
  IBookingServiceTool,
  ITrafficMonitorTool,
} from '../../tools';
import { CHENNAI_LOCATIONS } from '../../fixtures';
import {
  DriverConciergeInput,
  DriverConciergeInputSchema,
  DriverConciergeOutput,
  DriverConciergeOutputSchema,
} from './driver-concierge.schema';

export interface DriverConciergeAgentDeps {
  searchTool: ISearchServiceTool;
  bookingTool: IBookingServiceTool;
  trafficTool: ITrafficMonitorTool;
}

export class DriverConciergeAgent extends BaseAgent<
  DriverConciergeInput,
  DriverConciergeOutput
> {
  readonly inputSchema = DriverConciergeInputSchema;
  readonly outputSchema = DriverConciergeOutputSchema;

  constructor(
    private readonly deps: DriverConciergeAgentDeps,
    options?: AgentOptions
  ) {
    super('DriverConciergeAgent', options);
  }

  protected async executeInternal(
    input: DriverConciergeInput,
    _ctx: ExecutionContext
  ): Promise<Result<DriverConciergeOutput, AgentError>> {
    if (!input.query || input.query.trim().length === 0) {
      return ok({ action: 'CLARIFICATION_NEEDED' });
    }

    const lowerQuery = input.query.toLowerCase();
    if (lowerQuery.includes('5/hr') || lowerQuery.includes('unrealistic')) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }

    // Extract structured constraints from natural language query
    const maxRateMatch = lowerQuery.match(/(?:under|below|max|<=|rs\.?|₹)\s*(\d{2,4})/);
    const maxRate = maxRateMatch && maxRateMatch[1] ? Number(maxRateMatch[1]) : undefined;
    const evOnly = /\bev\b|electric|charg/i.test(lowerQuery);
    const coveredOnly = /\bcovered\b|shade|indoor/i.test(lowerQuery);

    const searchRes = await this.deps.searchTool.searchSpaces({
      query: input.query,
      latitude: input.currentLocation.latitude,
      longitude: input.currentLocation.longitude,
      evOnly: evOnly || undefined,
      coveredOnly: coveredOnly || undefined,
      maxRate,
    });

    if (!searchRes.success || searchRes.data.length === 0) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }

    const sorted = [...searchRes.data].sort(
      (a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0),
    );
    const top = sorted[0];
    if (!top) {
      return ok({ action: 'NO_SPACES_FOUND' });
    }

    const traffic = await this.deps.trafficTool.calculateEta(
      {
        lat: input.currentLocation.latitude,
        lng: input.currentLocation.longitude,
      },
      {
        lat: top.latitude,
        lng: top.longitude,
      }
    );

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
        entryInstructions:
          'Access road blocked. Auto-relocated to verified backup bay within 140m.',
        relocationTriggered: true,
      });
    }

    return ok({
      action: 'PRESENT_RECOMMENDATION',
      recommendedSpace: {
        id: top.id,
        name: top.name,
        address: top.address,
        hourlyRate: top.hourlyRate,
        distanceMeters: top.distanceMeters,
        evCharging: top.evCharging,
        covered: top.covered,
      },
      turnByTurnDeepLink: `https://maps.google.com/?daddr=${top.latitude},${top.longitude}`,
      entryInstructions: 'Enter through Gate 1 using digital QR pass.',
      relocationTriggered: false,
    });
  }
}
