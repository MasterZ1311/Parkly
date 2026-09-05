import { z } from 'zod';

export const DynamicPricingInputSchema = z.object({
  spaceId: z.string().min(1),
  baseHourlyRate: z.number().positive(),
  currentOccupancyRate: z.number().min(0).max(1),
  demandForecastTier: z.string().optional(),
  hostPricingPreferences: z
    .object({
      allowDynamic: z.boolean(),
      maxMultiplier: z.number().min(1.0),
    })
    .optional(),
});

export type DynamicPricingInput = z.infer<typeof DynamicPricingInputSchema>;

export const DynamicPricingOutputSchema = z.object({
  spaceId: z.string(),
  calculatedHourlyRate: z.number(),
  appliedMultiplier: z.number(),
  surgeReason: z.string(),
  effectiveFrom: z.string(),
  effectiveUntil: z.string(),
});

export type DynamicPricingOutput = z.infer<typeof DynamicPricingOutputSchema>;
