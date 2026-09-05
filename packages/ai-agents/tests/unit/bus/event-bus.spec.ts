import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryEventBus,
  createEventBridgeEvent,
  DOMAIN_EVENTS,
} from '../../../src';

describe('InMemoryEventBus & EventBridge Envelopes', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  it('delivers published event to matching subscriber', async () => {
    let receivedPayload: any = null;

    eventBus.subscribe(DOMAIN_EVENTS.SPACE_VISUALLY_AUDITED, (event) => {
      receivedPayload = event.detail;
    });

    const event = createEventBridgeEvent(DOMAIN_EVENTS.SPACE_VISUALLY_AUDITED, {
      spaceId: 'spc_001',
      inspectionResult: 'APPROVED',
    });

    await eventBus.publish(event);

    expect(receivedPayload).toEqual({
      spaceId: 'spc_001',
      inspectionResult: 'APPROVED',
    });
  });

  it('delivers published event to wildcard (*) subscribers', async () => {
    const receivedEvents: string[] = [];

    eventBus.subscribe('*', (event) => {
      receivedEvents.push(event['detail-type']);
    });

    await eventBus.publish(
      createEventBridgeEvent(DOMAIN_EVENTS.HOST_SUBMITTED, { userId: 'u1' })
    );
    await eventBus.publish(
      createEventBridgeEvent(DOMAIN_EVENTS.DISPUTE_RESOLVED, { disputeId: 'd1' })
    );

    expect(receivedEvents).toContain(DOMAIN_EVENTS.HOST_SUBMITTED);
    expect(receivedEvents).toContain(DOMAIN_EVENTS.DISPUTE_RESOLVED);
  });

  it('routes subscriber failure to Dead-Letter Queue (DLQ) without crashing bus', async () => {
    eventBus.subscribe(DOMAIN_EVENTS.PRICING_UPDATED, () => {
      throw new Error('Subscriber fatal processing crash');
    });

    const event = createEventBridgeEvent(DOMAIN_EVENTS.PRICING_UPDATED, {
      spaceId: 'spc_002',
      newRate: 56,
    });

    await expect(eventBus.publish(event)).resolves.not.toThrow();

    const dlq = eventBus.getDeadLetterQueue();
    expect(dlq.length).toBe(1);
    expect(dlq[0]?.reason).toBe('Subscriber handler threw an exception');
    expect(dlq[0]?.error.message).toBe('Subscriber fatal processing crash');
  });

  it('unsubscribes handler cleanly', async () => {
    let calls = 0;
    const unsubscribe = eventBus.subscribe(DOMAIN_EVENTS.BOOKING_CREATED, () => {
      calls++;
    });

    await eventBus.publish(
      createEventBridgeEvent(DOMAIN_EVENTS.BOOKING_CREATED, { bookingId: 'b1' })
    );
    expect(calls).toBe(1);

    unsubscribe();

    await eventBus.publish(
      createEventBridgeEvent(DOMAIN_EVENTS.BOOKING_CREATED, { bookingId: 'b2' })
    );
    expect(calls).toBe(1);
  });
});
