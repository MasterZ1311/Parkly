import { z } from 'zod';

export const CityAnalyticsInputSchema = z.object({
  cityId: z.string().min(1),
  period: z
    .string()
    .regex(/^\d{4}-W\d{2}$/, 'period must follow ISO week format YYYY-Www'),
  zones: z.array(z.string()).min(1),
});

export type CityAnalyticsInput = z.infer<typeof CityAnalyticsInputSchema>;

export const CityAnalyticsOutputSchema = z.object({
  cityId: z.string(),
  reportGeneratedAt: z.string(),
  metrics: z.object({
    totalOffStreetHoursProvided: z.number(),
    estimatedCurbsideCruisingReducedMinutes: z.number(),
    estimatedCO2AbatedKg: z.number(),
    unmetDemandChokePoints: z.array(z.record(z.unknown())),
  }),
  recommendation: z.string(),
});

export type CityAnalyticsOutput = z.infer<typeof CityAnalyticsOutputSchema>;
