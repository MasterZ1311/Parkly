import { z } from 'zod';

export const DriverConciergeInputSchema = z.object({
  driverId: z.string().min(1),
  query: z.string(),
  currentLocation: z.object({ latitude: z.number(), longitude: z.number() }),
});

export type DriverConciergeInput = z.infer<typeof DriverConciergeInputSchema>;

export const DriverConciergeOutputSchema = z.object({
  action: z.enum([
    'PRESENT_RECOMMENDATION',
    'CLARIFICATION_NEEDED',
    'NO_SPACES_FOUND',
  ]),
  recommendedSpace: z.record(z.unknown()).optional(),
  turnByTurnDeepLink: z.string().optional(),
  entryInstructions: z.string().optional(),
  relocationTriggered: z.boolean().optional(),
});

export type DriverConciergeOutput = z.infer<typeof DriverConciergeOutputSchema>;
