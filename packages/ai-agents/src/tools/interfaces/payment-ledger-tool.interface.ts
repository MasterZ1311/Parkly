import { Result, AgentError } from '../../core';

export interface LedgerTransaction {
  transactionId: string;
  bookingId: string;
  amount: number;
  currency: 'INR';
  action: 'CHARGE_PENALTY' | 'CREDIT_HOST' | 'REFUND' | 'HOLD_ESCROW';
  status: 'SUCCESS' | 'FROZEN_MANUAL_REVIEW';
  timestamp: string;
}

export interface IPaymentLedgerTool {
  chargePenalty(
    driverId: string,
    bookingId: string,
    amount: number,
    reason: string
  ): Promise<Result<LedgerTransaction, AgentError>>;

  creditCompensation(
    hostId: string,
    bookingId: string,
    amount: number,
    reason: string
  ): Promise<Result<LedgerTransaction, AgentError>>;

  refundDriver(
    driverId: string,
    bookingId: string,
    amount: number,
    reason: string
  ): Promise<Result<LedgerTransaction, AgentError>>;
}
