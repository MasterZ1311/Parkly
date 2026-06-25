// ============================================================
// Payment Service — Mock UPI Adapter + Tokenization
// PaymentProvider interface allows swapping Razorpay/Cashfree.
// SECURITY: Never store raw payment data.
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import {
  authenticate,
  requireRole,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  getConfig,
  generateId,
  publishEvent,
  ValidationError,
  PaymentError,
  NotFoundError,
  ApiResponse,
  Payment,
  PaymentStatus,
} from '@parkly/shared';

const PORT = process.env['PAYMENT_PORT'] || 4003;
const SERVICE_NAME = 'payment-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

// ============================================================
// Payment Provider Interface + Mock Implementation
// ============================================================

interface PaymentProvider {
  createOrder(amount: number, currency: string, bookingId: string): Promise<{
    orderId: string;
    upiVpa?: string;
    upiQrPayload?: string;
  }>;
  verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  refund(paymentId: string, amount: number): Promise<{ refundId: string }>;
}


class MockPaymentProvider implements PaymentProvider {
  async createOrder(amount: number, _currency: string, bookingId: string) {
    const upiVpa = getConfig().paymentUpiVpa || 'parkly@upi';
    logger.info({ amount, bookingId, upiVpa }, '[MOCK] Creating payment order');
    return {
      orderId: `MOCK_ORDER_${Date.now()}`,
      upiVpa,            // Client shows this as the UPI payment address
      upiQrPayload: `upi://pay?pa=${upiVpa}&pn=Parkly&am=${amount}&cu=INR&tn=Booking-${bookingId}`,
    };
  }


  async verifyPayment(_orderId: string, _paymentId: string, _signature: string) {
    logger.info('[MOCK] Payment verified');
    return true;
  }

  async refund(paymentId: string, amount: number) {
    logger.info({ paymentId, amount }, '[MOCK] Refund issued');
    return { refundId: `MOCK_REFUND_${Date.now()}` };
  }
}

function getPaymentProvider(): PaymentProvider {
  const config = getConfig();
  // In production: return new RazorpayProvider() or CashfreeProvider() based on config
  if (config.paymentProvider === 'mock') return new MockPaymentProvider();
  return new MockPaymentProvider(); // fallback
}

// ============================================================
// Payment Service Logic
// ============================================================

const paymentService = {
  async initiatePayment(bookingId: string, userId: string, amount: number): Promise<Payment & { upiVpa?: string; upiQrPayload?: string }> {
    const provider = getPaymentProvider();
    const { orderId, upiVpa, upiQrPayload } = await provider.createOrder(amount, 'INR', bookingId);

    const payment = await prisma.payment.create({
      data: {
        id: generateId(),
        bookingId,
        userId,
        amount,
        currency: 'INR',
        provider: getConfig().paymentProvider,
        providerOrderId: orderId,
        tokenRef: `TOKEN_${generateId()}`,
        status: 'pending',
      },
    });

    return { ...mapPayment(payment), upiVpa, upiQrPayload };
  },


  async confirmPayment(paymentId: string, providerPaymentId: string, signature: string): Promise<Payment> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.status !== 'pending') throw new PaymentError('Payment already processed');

    const provider = getPaymentProvider();
    const verified = await provider.verifyPayment(payment.providerOrderId!, providerPaymentId, signature);

    if (!verified) throw new PaymentError('Payment verification failed');

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed', providerPaymentId },
    });

    await publishEvent({
      type: 'PaymentCompleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'parkly.payment-service',
      data: { paymentId, bookingId: payment.bookingId, amount: payment.amount },
    });

    // Also update booking to confirmed
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'confirmed', paymentId },
    });

    return mapPayment(updated);
  },

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.status !== 'completed') throw new PaymentError('Only completed payments can be refunded');

    const refundAmount = amount || Number(payment.amount);
    const provider = getPaymentProvider();
    const { refundId } = await provider.refund(payment.providerPaymentId!, refundAmount);

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'refunded',
        refundAmount,
        refundId,
        refundedAt: new Date(),
      },
    });

    await publishEvent({
      type: 'RefundIssued',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'parkly.payment-service',
      data: { paymentId, refundAmount, refundId },
    });

    return mapPayment(updated);
  },
};

function mapPayment(raw: Record<string, unknown>): Payment {
  return {
    id: raw['id'] as string,
    bookingId: raw['bookingId'] as string,
    userId: raw['userId'] as string,
    amount: Number(raw['amount']),
    currency: 'INR',
    provider: raw['provider'] as 'mock',
    providerPaymentId: raw['providerPaymentId'] as string | undefined,
    providerOrderId: raw['providerOrderId'] as string | undefined,
    tokenRef: raw['tokenRef'] as string | undefined,
    status: raw['status'] as PaymentStatus,
    failureReason: raw['failureReason'] as string | undefined,
    refundAmount: raw['refundAmount'] ? Number(raw['refundAmount']) : undefined,
    refundId: raw['refundId'] as string | undefined,
    refundedAt: raw['refundedAt'] ? (raw['refundedAt'] as Date).toISOString() : undefined,
    createdAt: (raw['createdAt'] as Date).toISOString(),
    updatedAt: (raw['updatedAt'] as Date).toISOString(),
  };
}

// ============================================================
// Routes
// ============================================================

const paymentRouter = Router();
paymentRouter.use(authenticate);

const initiateSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
});

const confirmSchema = z.object({
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

// POST /payments/initiate
paymentRouter.post('/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = initiateSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');

    const payment = await paymentService.initiatePayment(
      result.data.bookingId,
      req.user!.sub,
      result.data.amount,
    );
    res.status(201).json({ success: true, data: payment } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /payments/:id/confirm
paymentRouter.put('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = confirmSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');

    const payment = await paymentService.confirmPayment(
      req.params['id']!,
      result.data.providerPaymentId,
      result.data.signature,
    );
    res.json({ success: true, data: payment } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /payments/:id/refund
paymentRouter.put('/:id/refund', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.refundPayment(req.params['id']!, req.body.amount);
    res.json({ success: true, data: payment } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// App
// ============================================================

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/payments', paymentRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
