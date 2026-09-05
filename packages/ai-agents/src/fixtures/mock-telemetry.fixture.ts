export const MOCK_TELEMETRY = {
  normalCommute: {
    spaceId: 'spc_annanagar_round_01',
    averageOccupancyRate: 0.7,
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
    scheduledEndTime: '2026-09-05T18:00:00.000Z',
    detectedExitTime: '2026-09-05T18:05:00.000Z',
    claimedDamageAmount: 4500, // > 1000 -> requires ESCALATED_MANUAL review
    adjudication: 'ESCALATED_MANUAL' as const,
  },
} as const;
