import { Result, ok, AgentError, ExecutionContext } from '../../core';
import { OccupancyPredictorAgent } from '../../agents/occupancy-predictor';
import { DynamicPricingAgent } from '../../agents/dynamic-pricing';
import { DriverConciergeAgent } from '../../agents/driver-concierge';
import { IBookingServiceTool } from '../../tools';
import { IEventBus } from '../../bus';

export interface BookingHoldSagaInput {
  spaceId: string;
  driverId: string;
  baseHourlyRate: number;
  durationHours: number;
}

export interface BookingHoldSagaResult {
  sagaStatus: 'COMPLETED';
  bookingId: string;
  holdExpiresAt: string;
  totalAmount: number;
  qrCode: string;
}

export class BookingHoldSaga {
  constructor(
    public readonly predictorAgent: OccupancyPredictorAgent,
    public readonly pricingAgent: DynamicPricingAgent,
    public readonly conciergeAgent: DriverConciergeAgent,
    public readonly bookingTool: IBookingServiceTool,
    public readonly eventBus: IEventBus
  ) {}

  public async execute(
    input: BookingHoldSagaInput,
    ctx: ExecutionContext
  ): Promise<Result<BookingHoldSagaResult, AgentError>> {
    // 1. Predict
    const predRes = await this.predictorAgent.execute(
      {
        spaceId: input.spaceId,
        targetArrivalTime: new Date().toISOString(),
        targetDurationMinutes: input.durationHours * 60,
      },
      ctx
    );
    if (!predRes.success) return predRes;

    // 2. Price
    const priceRes = await this.pricingAgent.execute(
      {
        spaceId: input.spaceId,
        baseHourlyRate: input.baseHourlyRate,
        currentOccupancyRate: 0.85,
      },
      ctx
    );
    if (!priceRes.success) return priceRes;

    // 3. Hold
    const holdRes = await this.bookingTool.createHold({
      spaceId: input.spaceId,
      driverId: input.driverId,
      durationHours: input.durationHours,
      hourlyRate: priceRes.data.calculatedHourlyRate,
    });
    if (!holdRes.success) return holdRes;

    return ok({
      sagaStatus: 'COMPLETED',
      bookingId: holdRes.data.bookingId,
      holdExpiresAt: holdRes.data.holdExpiresAt,
      totalAmount: holdRes.data.totalAmount,
      qrCode: holdRes.data.qrCode,
    });
  }
}
