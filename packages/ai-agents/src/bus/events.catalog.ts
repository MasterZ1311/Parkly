/**
 * Domain Events Catalog for Parkly Multi-Agent Ecosystem.
 * All domain events routed across EventBridge follow strict EventBridge naming patterns.
 */

export const DOMAIN_EVENTS = {
  HOST_SUBMITTED: 'Host.Submitted',
  HOST_KYC_VERIFIED: 'Host.KYCVerified',
  HOST_REVIEW_REQUESTED: 'Host.ReviewRequested',
  HOST_PAYOUT_INITIATED: 'Host.PayoutInitiated',

  SPACE_VISUALLY_AUDITED: 'Space.VisuallyAudited',
  SPACE_OBSTRUCTION_DETECTED: 'Space.ObstructionDetected',
  SPACE_ACTIVATED: 'Space.Activated',

  SEARCH_REQUESTED: 'Search.Requested',
  HOLD_INITIATED: 'Hold.Initiated',
  BOOKING_CREATED: 'Booking.Created',
  PAYMENT_COMPLETED: 'Payment.Completed',

  OCCUPANCY_CHANGED: 'Occupancy.Changed',
  PRICING_UPDATED: 'Pricing.Updated',

  DRIVER_REROUTED: 'Driver.Rerouted',

  DISPUTE_RAISED: 'Dispute.Raised',
  DISPUTE_RESOLVED: 'Dispute.Resolved',

  CITY_ANALYTICS_SCHEDULED: 'CityAnalytics.Scheduled',
  CITY_ANALYTICS_COMPLETED: 'CityAnalytics.Completed',

  AGENT_TIMEOUT_FALLBACK: 'Agent.TimeoutFallback',
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
