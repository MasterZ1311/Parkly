import { describe, it, expect, beforeEach } from 'vitest';
import {
  VisualInspectionAgent,
  MockVisionProvider,
  ExecutionContext,
  MOCK_PHOTOS,
} from '../../../src';

describe('VisualInspectionAgent Unit & Invariant Tests', () => {
  let visionTool: MockVisionProvider;
  let agent: VisualInspectionAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    visionTool = new MockVisionProvider();
    agent = new VisualInspectionAgent({ visionTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('approves space with clearance >= 2.2m and no obstructions', async () => {
    visionTool.setGateClearance(2.8);
    visionTool.setObstructions([]);

    const res = await agent.execute(
      {
        spaceId: 'spc_burkit_01',
        photoUrls: MOCK_PHOTOS.approvedSpace.photoUrls,
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.spaceId).toBe('spc_burkit_01');
    expect(res.data.inspectionResult).toBe('APPROVED');
    expect(res.data.privacyActions.licensePlatesBlurred).toBeGreaterThanOrEqual(1);
    expect(res.data.detectedAttributes.gateClearanceAdequate).toBe(true);
  });

  it('invariant: returns ACTION_REQUIRED with corrective advice when gate clearance < 2.2m', async () => {
    visionTool.setGateClearance(2.1); // < 2.2m threshold

    const res = await agent.execute(
      {
        spaceId: 'spc_narrow_gate_02',
        photoUrls: MOCK_PHOTOS.narrowGateObstruction.photoUrls,
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.inspectionResult).toBe('ACTION_REQUIRED');
    expect(res.data.detectedAttributes.gateClearanceAdequate).toBe(false);
  });

  it('invariant: returns ACTION_REQUIRED when physical obstruction is present', async () => {
    visionTool.setGateClearance(3.0);
    visionTool.setObstructions(['parked_scooter', 'loose_debris']);

    const res = await agent.execute(
      {
        spaceId: 'spc_blocked_03',
        photoUrls: ['https://s3.parkly.in/space/obstructed.jpg'],
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.inspectionResult).toBe('ACTION_REQUIRED');
  });

  it('fails with validation error when photoUrls is empty', async () => {
    const res = await agent.execute(
      {
        spaceId: 'spc_invalid_04',
        photoUrls: [],
      },
      ctx
    );

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.code).toBe('VALIDATION_ERROR');
  });
});
