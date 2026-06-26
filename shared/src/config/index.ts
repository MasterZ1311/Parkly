// ============================================================
// Parkly — Config Loader
// Reads from environment variables. Validates required fields.
// ============================================================

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env file regardless of which service is importing this.
// At runtime this file lives at shared/dist/config/index.js, so the repo
// root is three levels up (config -> dist -> shared -> <root>). The same
// relative depth also holds for shared/src/config when run via ts-node.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface AppConfig {
  // General
  nodeEnv: string;
  logLevel: string;
  cityDefault: string;

  // JWT
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: number;
  jwtRefreshTtl: number;

  // AWS
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  awsAccountId?: string;

  // DynamoDB
  dynamoTableOtp: string;
  dynamoTableOccupancy: string;
  dynamoTableNotifications: string;
  dynamoEndpoint?: string;

  // S3
  s3BucketUploads: string;
  s3BucketDatalake: string;

  // SNS
  snsSmsSenderId: string;

  // EventBridge
  eventBusName: string;

  // Payment
  paymentProvider: 'mock' | 'razorpay' | 'cashfree';
  paymentApiKey?: string;
  paymentApiSecret?: string;
  paymentWebhookSecret?: string;
  paymentUpiVpa?: string;
  platformCommissionPct: number;

  // SMS
  smsProvider: 'mock' | 'twilio' | 'sns';
  smsApiKey?: string;

  // Maps
  googleMapsApiKey?: string;

  // Push Notifications (FCM / APNS)
  pushProvider: 'mock' | 'fcm';
  fcmProjectId?: string;
  fcmClientEmail?: string;
  fcmPrivateKey?: string;
  apnsKeyId?: string;
  apnsTeamId?: string;
  apnsBundleId?: string;

  // Bedrock
  bedrockRegion: string;
  bedrockModelId: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

function intEnv(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Environment variable ${key} must be an integer`);
  return n;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  _config = {
    // General
    nodeEnv: process.env['NODE_ENV'] || 'development',
    logLevel: process.env['LOG_LEVEL'] || 'info',
    cityDefault: process.env['CITY_DEFAULT'] || 'chennai',

    // JWT
    jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    jwtAccessTtl: intEnv('JWT_ACCESS_TTL', 900),
    jwtRefreshTtl: intEnv('JWT_REFRESH_TTL', 2592000),

    // AWS
    awsRegion: process.env['AWS_REGION'] || 'us-east-1',
    awsAccessKeyId: optionalEnv('AWS_ACCESS_KEY_ID'),
    awsSecretAccessKey: optionalEnv('AWS_SECRET_ACCESS_KEY'),
    awsSessionToken: optionalEnv('AWS_SESSION_TOKEN'),
    awsAccountId: optionalEnv('AWS_ACCOUNT_ID'),

    // DynamoDB
    dynamoTableOtp: process.env['DYNAMO_TABLE_OTP'] || 'parkly-otp',
    dynamoTableOccupancy: process.env['DYNAMO_TABLE_OCCUPANCY'] || 'parkly-occupancy',
    dynamoTableNotifications: process.env['DYNAMO_TABLE_NOTIFICATIONS'] || 'parkly-notifications',
    dynamoEndpoint: optionalEnv('DYNAMO_ENDPOINT'),

    // S3
    s3BucketUploads: process.env['S3_BUCKET_UPLOADS'] || 'parkly-uploads',
    s3BucketDatalake: process.env['S3_BUCKET_DATALAKE'] || 'parkly-datalake',

    // SNS
    snsSmsSenderId: process.env['SNS_SMS_SENDER_ID'] || 'PARKLY',

    // EventBridge
    eventBusName: process.env['EVENT_BUS_NAME'] || 'parkly-event-bus',

    // Payment
    paymentProvider: (process.env['PAYMENT_PROVIDER'] as AppConfig['paymentProvider']) || 'mock',
    paymentApiKey: optionalEnv('PAYMENT_API_KEY'),
    paymentApiSecret: optionalEnv('PAYMENT_API_SECRET'),
    paymentWebhookSecret: optionalEnv('PAYMENT_WEBHOOK_SECRET'),
    paymentUpiVpa: optionalEnv('PAYMENT_UPI_VPA'),
    platformCommissionPct: intEnv('PLATFORM_COMMISSION_PCT', 15),

    // SMS
    smsProvider: (process.env['SMS_PROVIDER'] as AppConfig['smsProvider']) || 'mock',
    smsApiKey: optionalEnv('SMS_API_KEY'),

    // Maps
    googleMapsApiKey: optionalEnv('GOOGLE_MAPS_API_KEY'),

    // Push Notifications
    pushProvider: (process.env['PUSH_PROVIDER'] as AppConfig['pushProvider']) || 'mock',
    fcmProjectId: optionalEnv('FCM_PROJECT_ID'),
    fcmClientEmail: optionalEnv('FCM_CLIENT_EMAIL'),
    fcmPrivateKey: optionalEnv('FCM_PRIVATE_KEY'),
    apnsKeyId: optionalEnv('APNS_KEY_ID'),
    apnsTeamId: optionalEnv('APNS_TEAM_ID'),
    apnsBundleId: optionalEnv('APNS_BUNDLE_ID'),

    // Bedrock
    bedrockRegion: process.env['BEDROCK_REGION'] || 'us-east-1',
    bedrockModelId:
      process.env['BEDROCK_MODEL_ID'] || 'anthropic.claude-3-sonnet-20240229-v1:0',
  };

  return _config;
}

// Reset for testing
export function resetConfig(): void {
  _config = null;
}
