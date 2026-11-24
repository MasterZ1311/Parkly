import { z } from 'zod';

export const OccupancyPredictorInputSchema = z.object({
  spaceId: z.string().min(1),
  targetArrivalTime: z.string(),
  targetDurationMinutes: z.number().int().positive(),
  userCurrentLocation: z
    .object({ latitude: z.number(), longitude: z.number() })
    .optional(),
});

export type OccupancyPredictorInput = z.infer<typeof OccupancyPredictorInputSchema>;

export const OccupancyPredictorOutputSchema = z.object({
  spaceId: z.string(),
  arrivalProbability: z.number(),
  confidenceScore: z.number(),
  estimatedAvailableSlots: z.number(),
  demandTier: z.string(),
  contextualFactors: z.array(z.string()),
});

export type OccupancyPredictorOutput = z.infer<typeof OccupancyPredictorOutputSchema>;
