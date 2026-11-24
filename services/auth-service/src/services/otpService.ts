// ============================================================
// Auth Service — OTP Service
// Generates, stores, and verifies OTPs using DynamoDB (TTL).
// ============================================================

import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, MessageAttributeValue } from '@aws-sdk/client-sns';
import {
  getDocClient,
  getSNSClient,
  getConfig,
  generateOtp,
  normalizePhoneNumber,
  logger,
  AuthenticationError,
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
  async requestOtp(rawPhone: string): Promise<string> {
    const phone = normalizePhoneNumber(rawPhone);
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

    logger.info({ phone: phone.slice(0, 4) + '***' + phone.slice(-2) }, 'OTP generated');

    // Send OTP via configured SMS provider
    const config = getConfig();
    if (config.smsProvider === 'sns') {
      try {
        const messageAttributes: Record<string, MessageAttributeValue> = {
          'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: config.snsSmsSenderId || 'PARKLY' },
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        };

        // Indian DLT Compliance Attributes (TRAI requirement)
        if (config.snsSmsEntityId) {
          messageAttributes['AWS.MM.SMS.EntityId'] = { DataType: 'String', StringValue: config.snsSmsEntityId };
          messageAttributes['AWS.SNS.SMS.EntityId'] = { DataType: 'String', StringValue: config.snsSmsEntityId };
        }
        if (config.snsSmsTemplateId) {
          messageAttributes['AWS.MM.SMS.TemplateId'] = { DataType: 'String', StringValue: config.snsSmsTemplateId };
          messageAttributes['AWS.SNS.SMS.TemplateId'] = { DataType: 'String', StringValue: config.snsSmsTemplateId };
        }

        const message = `Your Parkly verification code is: ${otp}. Valid for 5 minutes.`;

        await getSNSClient().send(
          new PublishCommand({
            PhoneNumber: phone,
            Message: message,
            MessageAttributes: messageAttributes,
          }),
        );
        logger.info({ phone: phone.slice(0, 4) + '***' + phone.slice(-2) }, 'OTP sent via SNS SMS');
      } catch (err: any) {
        logger.error({ err: err?.message || err, phone: phone.slice(0, 4) + '***' }, 'Failed to send OTP via SNS');
        if (config.nodeEnv === 'production') {
          throw new AuthenticationError('Failed to deliver verification code. Please check your phone number and try again.');
        }
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
  async verifyOtp(rawPhone: string, otp: string): Promise<string> {
    const phone = normalizePhoneNumber(rawPhone);
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
    return phone;
  }
}

export const otpService = new OtpService();

