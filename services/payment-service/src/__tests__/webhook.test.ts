import * as crypto from 'crypto';
import { paymentService } from '../index';
import { prisma } from '../index';
import { publishEvent } from '@parkly/shared';

// Mock @parkly/shared publishEvent
jest.mock('@parkly/shared', () => {
  const original = jest.requireActual('@parkly/shared');
  return {
    ...original,
    publishEvent: jest.fn().mockResolvedValue(undefined),
  };
});

describe('Razorpay Webhook HMAC Verification', () => {
  const webhookSecret = 'test_webhook_secret_key_12345';
  const payload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_H6z812kABCDEFG',
          order_id: 'order_H6z812kORDER12',
          amount: 15000,
          status: 'captured',
        },
      },
    },
  });

  function computeHmac(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  it('verifies valid Razorpay webhook signature computed over raw body', () => {
    const validSignature = computeHmac(payload, webhookSecret);
    const result = verifyHmac(payload, validSignature, webhookSecret);
    expect(result).toBe(true);
  });

  it('rejects tampered webhook payload', () => {
    const validSignature = computeHmac(payload, webhookSecret);
    const tamperedPayload = payload.replace('15000', '10000');
    const result = verifyHmac(tamperedPayload, validSignature, webhookSecret);
    expect(result).toBe(false);
  });

  it('rejects invalid or forged webhook signature', () => {
    const forgedSignature = crypto.randomBytes(32).toString('hex');
    const result = verifyHmac(payload, forgedSignature, webhookSecret);
    expect(result).toBe(false);
  });

  it('rejects signature of different length safely without throwing', () => {
    const shortSignature = 'abc123';
    const result = verifyHmac(payload, shortSignature, webhookSecret);
    expect(result).toBe(false);
  });
});

describe('paymentService.handleWebhookCapture', () => {
  const mockPayment = {
    id: 'pay-uuid-001',
    bookingId: 'book-uuid-001',
    userId: 'user-uuid-001',
    amount: 150,
    currency: 'INR',
    provider: 'razorpay',
    providerOrderId: 'order_H6z812kORDER12',
    tokenRef: 'TOKEN_123',
    status: 'pending',
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirms payment and updates booking directly without checkout signature verification', async () => {
    const findFirstSpy = jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(mockPayment as any);
    const txSpy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (cb: any) => cb(prisma));
    const updatePaymentSpy = jest.spyOn(prisma.payment, 'update').mockResolvedValue({
      ...mockPayment,
      status: 'completed',
      providerPaymentId: 'pay_H6z812kABCDEFG',
    } as any);
    const updateBookingSpy = jest.spyOn(prisma.booking, 'update').mockResolvedValue({} as any);

    const result = await paymentService.handleWebhookCapture(
      'order_H6z812kORDER12',
      'pay_H6z812kABCDEFG',
    );

    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(findFirstSpy).toHaveBeenCalledWith({ where: { providerOrderId: 'order_H6z812kORDER12' } });
    expect(updatePaymentSpy).toHaveBeenCalledWith({
      where: { id: 'pay-uuid-001' },
      data: { status: 'completed', providerPaymentId: 'pay_H6z812kABCDEFG' },
    });
    expect(updateBookingSpy).toHaveBeenCalledWith({
      where: { id: 'book-uuid-001' },
      data: { status: 'confirmed', paymentId: 'pay-uuid-001' },
    });
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PaymentCompleted',
        source: 'parkly.payment-service',
        data: expect.objectContaining({
          paymentId: 'pay-uuid-001',
          bookingId: 'book-uuid-001',
          providerPaymentId: 'pay_H6z812kABCDEFG',
        }),
      }),
    );
    expect(result).toBeDefined();
    expect(result?.status).toBe('completed');
  });

  it('skips processing if payment is already completed (idempotency)', async () => {
    const completedPayment = { ...mockPayment, status: 'completed' };
    jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(completedPayment as any);
    const updatePaymentSpy = jest.spyOn(prisma.payment, 'update');

    const result = await paymentService.handleWebhookCapture(
      'order_H6z812kORDER12',
      'pay_H6z812kABCDEFG',
    );

    expect(updatePaymentSpy).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
    expect(result?.status).toBe('completed');
  });

  it('returns null when order is not found', async () => {
    jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);

    const result = await paymentService.handleWebhookCapture('unknown_order', 'pay_xyz');
    expect(result).toBeNull();
  });
});
