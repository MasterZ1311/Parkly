import { OtpService } from '../services/otpService';
import { getDocClient, getSNSClient, getConfig } from '@parkly/shared';

jest.mock('@parkly/shared', () => {
  const original = jest.requireActual('@parkly/shared');
  return {
    ...original,
    getDocClient: jest.fn(),
    getSNSClient: jest.fn(),
    getConfig: jest.fn(),
  };
});

describe('OtpService', () => {
  let otpService: OtpService;
  let mockDocSend: jest.Mock;
  let mockSnsSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocSend = jest.fn().mockResolvedValue({});
    mockSnsSend = jest.fn().mockResolvedValue({ MessageId: 'msg-123' });

    (getDocClient as jest.Mock).mockReturnValue({ send: mockDocSend });
    (getSNSClient as jest.Mock).mockReturnValue({ send: mockSnsSend });

    (getConfig as jest.Mock).mockReturnValue({
      dynamoTableOtp: 'parkly-otp',
      smsProvider: 'sns',
      snsSmsSenderId: 'PARKLY',
      snsSmsEntityId: '11015243800000',
      snsSmsTemplateId: '11071615882399',
      nodeEnv: 'development',
    });

    otpService = new OtpService();
  });

  describe('requestOtp', () => {
    it('normalizes 10-digit Indian phone to E.164 and dispatches via AWS SNS with TRAI DLT attributes', async () => {
      const otp = await otpService.requestOtp('9876543210');

      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);

      // Verify DynamoDB PutCommand was called with E.164 normalized phone
      expect(mockDocSend).toHaveBeenCalledTimes(1);
      const putArgs = mockDocSend.mock.calls[0][0];
      expect(putArgs.input.TableName).toBe('parkly-otp');
      expect(putArgs.input.Item.phone).toBe('+919876543210');
      expect(putArgs.input.Item.otp).toBe(otp);

      // Verify SNS PublishCommand was called with E.164 phone and DLT attributes
      expect(mockSnsSend).toHaveBeenCalledTimes(1);
      const publishArgs = mockSnsSend.mock.calls[0][0];
      expect(publishArgs.input.PhoneNumber).toBe('+919876543210');
      expect(publishArgs.input.Message).toContain(otp);
      expect(publishArgs.input.MessageAttributes).toMatchObject({
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'PARKLY' },
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        'AWS.MM.SMS.EntityId': { DataType: 'String', StringValue: '11015243800000' },
        'AWS.SNS.SMS.EntityId': { DataType: 'String', StringValue: '11015243800000' },
        'AWS.MM.SMS.TemplateId': { DataType: 'String', StringValue: '11071615882399' },
        'AWS.SNS.SMS.TemplateId': { DataType: 'String', StringValue: '11071615882399' },
      });
    });

    it('normalizes phone with leading zero, spaces and dashes', async () => {
      const otp = await otpService.requestOtp('09876-543 210');
      expect(otp).toHaveLength(6);

      const putArgs = mockDocSend.mock.calls[0][0];
      expect(putArgs.input.Item.phone).toBe('+919876543210');

      const publishArgs = mockSnsSend.mock.calls[0][0];
      expect(publishArgs.input.PhoneNumber).toBe('+919876543210');
    });

    it('falls back gracefully in non-production when SNS dispatch fails', async () => {
      mockSnsSend.mockRejectedValue(new Error('SNS service unreachable'));

      const otp = await otpService.requestOtp('+919876543210');
      expect(otp).toHaveLength(6);
      expect(mockDocSend).toHaveBeenCalled();
    });

    it('throws AuthenticationError in production when SNS dispatch fails', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        dynamoTableOtp: 'parkly-otp',
        smsProvider: 'sns',
        snsSmsSenderId: 'PARKLY',
        nodeEnv: 'production',
      });

      mockSnsSend.mockRejectedValue(new Error('SNS delivery failure'));

      await expect(otpService.requestOtp('9876543210')).rejects.toThrow(
        'Failed to deliver verification code. Please check your phone number and try again.',
      );
    });

    it('generates mock OTP without calling SNS when smsProvider is mock', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        dynamoTableOtp: 'parkly-otp',
        smsProvider: 'mock',
        nodeEnv: 'development',
      });

      const otp = await otpService.requestOtp('9876543210');
      expect(otp).toHaveLength(6);
      expect(mockDocSend).toHaveBeenCalled();
      expect(mockSnsSend).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('verifies valid OTP successfully with normalized phone', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockDocSend
        .mockResolvedValueOnce({
          Item: {
            phone: '+919876543210',
            otp: '123456',
            attempts: 0,
            expiresAt: now + 300,
          },
        })
        .mockResolvedValueOnce({});

      const verifiedPhone = await otpService.verifyOtp('9876543210', '123456');
      expect(verifiedPhone).toBe('+919876543210');
      expect(mockDocSend).toHaveBeenCalledTimes(2);
    });

    it('throws if OTP record not found', async () => {
      mockDocSend.mockResolvedValueOnce({});

      await expect(otpService.verifyOtp('9876543210', '123456')).rejects.toThrow(
        'OTP not found or expired',
      );
    });

    it('throws and increments attempt count on incorrect OTP', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockDocSend
        .mockResolvedValueOnce({
          Item: {
            phone: '+919876543210',
            otp: '654321',
            attempts: 1,
            expiresAt: now + 300,
          },
        })
        .mockResolvedValueOnce({});

      await expect(otpService.verifyOtp('9876543210', '123456')).rejects.toThrow(
        'Invalid OTP. 3 attempts remaining.',
      );
    });
  });
});
