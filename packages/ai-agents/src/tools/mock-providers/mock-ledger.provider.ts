import { randomUUID } from 'node:crypto';
import { Result, ok, AgentError } from '../../core';
import {
  IPaymentLedgerTool,
  LedgerTransaction,
} from '../interfaces/payment-ledger-tool.interface';

export class MockPaymentLedgerProvider implements IPaymentLedgerTool {
  private transactions: LedgerTransaction[] = [];

  public async chargePenalty(
    _driverId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_pen_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'CHARGE_PENALTY',
      status: amount > 1000 ? 'FROZEN_MANUAL_REVIEW' : 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public async creditCompensation(
    _hostId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_comp_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'CREDIT_HOST',
      status: amount > 1000 ? 'FROZEN_MANUAL_REVIEW' : 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public async refundDriver(
    _driverId: string,
    bookingId: string,
    amount: number,
    _reason: string
  ): Promise<Result<LedgerTransaction, AgentError>> {
    const tx: LedgerTransaction = {
      transactionId: `tx_ref_${randomUUID().substring(0, 8)}`,
      bookingId,
      amount,
      currency: 'INR',
      action: 'REFUND',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return ok(tx);
  }

  public getTransactions(): LedgerTransaction[] {
    return [...this.transactions];
  }

  public reset(): void {
    this.transactions = [];
  }
}
