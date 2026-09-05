import { z } from 'zod';

export const OrchestratorRouteEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  'detail-type': z.string(),
  time: z.string(),
  detail: z.unknown(),
  correlationId: z.string().optional(),
});

export type OrchestratorRouteEvent = z.infer<typeof OrchestratorRouteEventSchema>;
