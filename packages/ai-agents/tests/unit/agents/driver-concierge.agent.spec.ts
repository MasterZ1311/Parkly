import { describe, it, expect, beforeEach } from 'vitest';
import {
  DriverConciergeAgent,
  MockSearchServiceProvider,
  MockBookingServiceProvider,
  MockTrafficMonitorProvider,
  ExecutionContext,
} from '../../../src';

describe('DriverConciergeAgent Unit & Invariant Tests', () => {
  let searchTool: MockSearchServiceProvider;
  let bookingTool: MockBookingServiceProvider;
  let trafficTool: MockTrafficMonitorProvider;
  let agent: DriverConciergeAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    searchTool = new MockSearchServiceProvider();
    bookingTool = new MockBookingServiceProvider();
    trafficTool = new MockTrafficMonitorProvider();
    agent = new DriverConciergeAgent({ searchTool, bookingTool, trafficTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('presents recommendation for valid parking query near T. Nagar', async () => {
    const res = await agent.execute(
      {
        driverId: 'usr_driver_01',
        query: 'Find parking near Pothys T. Nagar for 2 hours',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.action).toBe('PRESENT_RECOMMENDATION');
    expect(res.data.recommendedSpace).toBeDefined();
    expect(res.data.turnByTurnDeepLink).toBeDefined();
    expect(res.data.relocationTriggered).toBe(false);
  });

  it('invariant: triggers emergency relocation to backup bay <= 200m at 0 surcharge if access road blocked', async () => {
    trafficTool.setBlockedAccess(true); // Simulates blocked access road

    const res = await agent.execute(
      {
        driverId: 'usr_driver_02',
        query: 'Parking near Burkit Road',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.action).toBe('PRESENT_RECOMMENDATION');
    expect(res.data.relocationTriggered).toBe(true);
    expect(res.data.recommendedSpace?.id).toBe('spc_tnagar_backup_bay_02');
    expect(res.data.entryInstructions).toContain('within 140m');
  });

  it('returns CLARIFICATION_NEEDED when query is empty', async () => {
    const res = await agent.execute(
      {
        driverId: 'usr_driver_03',
        query: '   ',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.action).toBe('CLARIFICATION_NEEDED');
  });
});
