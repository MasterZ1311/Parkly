import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  ok,
  AgentError,
} from '../../core';
import { IOcrTool, IGeocodingTool, IZoningTool } from '../../tools';
import {
  HostOnboardingInput,
  HostOnboardingInputSchema,
  HostOnboardingOutput,
  HostOnboardingOutputSchema,
} from './host-onboarding.schema';

export interface HostOnboardingAgentDeps {
  ocrTool: IOcrTool;
  geocodingTool: IGeocodingTool;
  zoningTool: IZoningTool;
}

export class HostOnboardingAgent extends BaseAgent<
  HostOnboardingInput,
  HostOnboardingOutput
> {
  readonly inputSchema = HostOnboardingInputSchema;
  readonly outputSchema = HostOnboardingOutputSchema;

  constructor(
    private readonly deps: HostOnboardingAgentDeps,
    options?: AgentOptions
  ) {
    super('HostOnboardingAgent', options);
  }

  protected async executeInternal(
    input: HostOnboardingInput,
    _ctx: ExecutionContext
  ): Promise<Result<HostOnboardingOutput, AgentError>> {
    const firstDoc = input.documentUrls[0];
    if (!firstDoc) {
      return ok({
        hostId: `host_${input.userId}`,
        kycStatus: 'MANUAL_REVIEW_REQUIRED',
        confidenceScore: 0,
        extractedIdentity: {},
        geocoding: {
          latitude: 0,
          longitude: 0,
          geohash: '',
          normalizedAddress: input.rawAddress,
        },
        zoningCompliance: 'AMBIGUOUS',
      });
    }

    const ocrResult = await this.deps.ocrTool.parseDocument(firstDoc);
    if (!ocrResult.success) return ocrResult;

    const geocodeResult = await this.deps.geocodingTool.geocode(input.rawAddress);
    if (!geocodeResult.success) return geocodeResult;

    const zoningResult = await this.deps.zoningTool.checkCompliance(
      geocodeResult.data.latitude,
      geocodeResult.data.longitude
    );
    if (!zoningResult.success) return zoningResult;

    const ocrConfidence = ocrResult.data.confidenceScore;
    const isZoningPass =
      zoningResult.data.status === 'RESIDENTIAL_PERMITTED' ||
      zoningResult.data.status === 'COMMERCIAL_PERMITTED';

    // Strict invariant: OCR < 0.85 or zoning non-residential -> MANUAL_REVIEW_REQUIRED
    const kycStatus =
      ocrConfidence >= 0.85 && isZoningPass
        ? 'VERIFIED_AUTO'
        : 'MANUAL_REVIEW_REQUIRED';

    return ok({
      hostId: `host_${input.userId}`,
      kycStatus,
      confidenceScore: ocrConfidence,
      extractedIdentity: ocrResult.data.extractedFields,
      geocoding: {
        latitude: geocodeResult.data.latitude,
        longitude: geocodeResult.data.longitude,
        geohash: geocodeResult.data.geohash,
        normalizedAddress: geocodeResult.data.normalizedAddress,
      },
      zoningCompliance: zoningResult.data.status,
    });
  }
}
