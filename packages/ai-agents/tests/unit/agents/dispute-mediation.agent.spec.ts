import { describe, it, expect, beforeEach } from 'vitest';
import {
  DisputeMediationAgent,
  MockSensorVerificationProvider,
  MockPaymentLedgerProvider,
  MockNotificationProvider,
  ExecutionContext,
} from '../../../src';

describe('DisputeMediationAgent Unit & Invariant Tests', () => {
  let sensorTool: MockSensorVerificationProvider;
  let ledgerTool: MockPaymentLedgerProvider;
  let notificationTool: MockNotificationProvider;
  let agent: DisputeMediationAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    sensorTool = new MockSensorVerificationProvider();
    ledgerTool = new MockPaymentLedgerProvider();
    notificationTool = new MockNotificationProvider();
    agent = new DisputeMediationAgent({ sensorTool, ledgerTool, notificationTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('confirms overstay violation and dispatches penalties & compensation below threshold', async () => {
    sensorTool.setOverstayMinutes(90);

    const res = await agent.execute(
      {
        disputeId: 'disp_001',
        bookingId: 'bk_8821',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'host_01',
        evidence: { claimAmount: 100 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.adjudication).toBe('OVERSTAY_CONFIRMED');
    expect(res.data.hostCompensationAmount).toBe(100);
    expect(res.data.actionsTaken).toContain('PENALTY_CHARGED');
    expect(res.data.actionsTaken).toContain('HOST_CREDITED');
    expect(notificationTool.getSentNotifications().length).toBeGreaterThan(0);
  });

  it('invariant: freezes payout and escalates to ESCALATED_MANUAL when claim exceeds ₹1,000 threshold', async () => {
    const res = await agent.execute(
      {
        disputeId: 'disp_high_value_02',
        bookingId: 'bk_9934',
        incidentType: 'PROPERTY_DAMAGE_CLAIM',
        reportedBy: 'host_02',
        evidence: { claimAmount: 2500 }, // > ₹1,000 threshold
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.adjudication).toBe('ESCALATED_MANUAL');
    expect(res.data.hostCompensationAmount).toBe(0);
    expect(res.data.actionsTaken).toContain('PAYOUT_FROZEN_HIGH_VALUE_THRESHOLD');
    expect(res.data.actionsTaken).toContain('ESCALATED_TO_HUMAN_OPS');
  });

  it('dismisses dispute when sensor logs show departure on time', async () => {
    sensorTool.setOverstayMinutes(0);

    const res = await agent.execute(
      {
        disputeId: 'disp_false_03',
        bookingId: 'bk_4411',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'host_03',
        evidence: { claimAmount: 80 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.adjudication).toBe('DISPUTE_DISMISSED');
    expect(res.data.hostCompensationAmount).toBe(0);
  });
});
