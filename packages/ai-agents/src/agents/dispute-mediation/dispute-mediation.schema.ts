import { z } from 'zod';

export const DisputeMediationInputSchema = z.object({
  disputeId: z.string().min(1),
  bookingId: z.string().min(1),
  incidentType: z.string(),
  reportedBy: z.string(),
  evidence: z.record(z.unknown()).optional(),
});

export type DisputeMediationInput = z.infer<typeof DisputeMediationInputSchema>;

export const DisputeMediationOutputSchema = z.object({
  disputeId: z.string(),
  adjudication: z.enum([
    'OVERSTAY_CONFIRMED',
    'DISPUTE_DISMISSED',
    'ESCALATED_MANUAL',
    'REFUND_ISSUED',
  ]),
  actionsTaken: z.array(z.string()),
  hostCompensationAmount: z.number(),
  platformAuditLog: z.string(),
});

export type DisputeMediationOutput = z.infer<typeof DisputeMediationOutputSchema>;
