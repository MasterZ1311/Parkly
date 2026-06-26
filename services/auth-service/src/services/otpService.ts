// ============================================================
// Auth Service — OTP Service
// Generates, stores, and verifies OTPs using DynamoDB (TTL).
// ============================================================

import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand } from '@aws-sdk/client-sns';
import {
  getDocClient,
  getSNSClient,
  getConfig,
  generateOtp,
  logger,
  AuthenticationError,
  ValidationError,
} from '@parkly/shared';

const MAX_ATTEMPTS = 5;
const OTP_TTL_SECONDS = 300; // 5 minutes

export class OtpService {
  private get tableName(): string {
    return getConfig().dynamoTableOtp;
  }

  /**
   * Generate and store an OTP for the given phone number.
   * Returns the OTP (send via SMS in production).
   */
  async requestOtp(phone: string): Promise<string> {
    const otp = generateOtp();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + OTP_TTL_SECONDS;

    await getDocClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          phone,
          otp,
          attempts: 0,
          expiresAt,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    logger.info({ phone: phone.slice(0, 4) + '***' }, 'OTP generated');

    // Send OTP via configured SMS provider
    const config = getConfig();
    if (config.smsProvider === 'sns') {
      try {
        await getSNSClient().send(
          new PublishCommand({
            PhoneNumber: phone,
            Message: `Your Parkly verification code is: ${otp}. Valid for 5 minutes.`,
            MessageAttributes: {
              'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: config.snsSmsSenderId },
              'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
            },
          }),
        );
        logger.info({ phone: phone.slice(0, 4) + '***' }, 'OTP sent via SNS SMS');
      } catch (err) {
        logger.error({ err, phone: phone.slice(0, 4) + '***' }, 'Failed to send OTP via SNS');
        // Still return the OTP so it's stored — caller can retry or fallback
      }
    } else {
      logger.info({ otp, phone: phone.slice(0, 4) + '***' }, '[MOCK] OTP generated — use this in dev');
    }

    return otp;
  }

  /**
   * Verify an OTP. Increments attempt count.
   * Throws on invalid/expired OTP or too many attempts.
   */
  async verifyOtp(phone: string, otp: string): Promise<void> {
    const result = await getDocClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: { phone },
      }),
    );

    if (!result.Item) {
      throw new AuthenticationError('OTP not found or expired');
    }

    const record = result.Item;
    const now = Math.floor(Date.now() / 1000);

    if (record['expiresAt'] < now) {
      throw new AuthenticationError('OTP has expired');
    }

    if (record['attempts'] >= MAX_ATTEMPTS) {
      throw new AuthenticationError('Too many OTP attempts. Please request a new OTP.');
    }

    if (record['otp'] !== otp) {
      // Increment attempt count
      await getDocClient().send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { phone },
          UpdateExpression: 'SET attempts = attempts + :inc',
          ExpressionAttributeValues: { ':inc': 1 },
        }),
      );
      const remaining = MAX_ATTEMPTS - (record['attempts'] + 1);
      throw new AuthenticationError(
        `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    // OTP verified — delete it (single-use)
    await getDocClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...record,
          expiresAt: now - 1, // force expire immediately
          verified: true,
        },
      }),
    );

    logger.info({ phone: phone.slice(0, 4) + '***' }, 'OTP verified successfully');
  }
}

export const otpService = new OtpService();
