import { z } from 'zod';

export const VisualInspectionInputSchema = z.object({
  spaceId: z.string().min(1),
  photoUrls: z.array(z.string()).min(1),
});

export type VisualInspectionInput = z.infer<typeof VisualInspectionInputSchema>;

export const VisualInspectionOutputSchema = z.object({
  spaceId: z.string(),
  inspectionResult: z.enum(['APPROVED', 'REJECTED', 'ACTION_REQUIRED']),
  detectedAttributes: z.record(z.unknown()),
  privacyActions: z.object({
    licensePlatesBlurred: z.number(),
    facesBlurred: z.number(),
  }),
  generatedDescription: z.string(),
});

export type VisualInspectionOutput = z.infer<typeof VisualInspectionOutputSchema>;
