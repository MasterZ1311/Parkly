import { z } from 'zod';

export const HostOnboardingInputSchema = z.object({
  userId: z.string().min(1),
  rawAddress: z.string().min(1),
  documentUrls: z.array(z.string()).min(1),
  declaredSlots: z.number().int().positive(),
  vehicleTypes: z.array(z.string()).min(1),
});

export type HostOnboardingInput = z.infer<typeof HostOnboardingInputSchema>;

export const HostOnboardingOutputSchema = z.object({
  hostId: z.string(),
  kycStatus: z.enum(['VERIFIED_AUTO', 'MANUAL_REVIEW_REQUIRED']),
  confidenceScore: z.number(),
  extractedIdentity: z.record(z.unknown()),
  geocoding: z.object({
    latitude: z.number(),
    longitude: z.number(),
    geohash: z.string(),
    normalizedAddress: z.string(),
  }),
  zoningCompliance: z.string(),
});

export type HostOnboardingOutput = z.infer<typeof HostOnboardingOutputSchema>;
