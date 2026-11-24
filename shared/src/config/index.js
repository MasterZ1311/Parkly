"use strict";
// ============================================================
// Parkly — Config Loader
// Reads from environment variables. Validates required fields.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
function requireEnv(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing required environment variable: ${key}`);
    return val;
}
function optionalEnv(key) {
    return process.env[key] || undefined;
}
function intEnv(key, defaultVal) {
    const val = process.env[key];
    if (!val)
        return defaultVal;
    const n = parseInt(val, 10);
    if (isNaN(n))
        throw new Error(`Environment variable ${key} must be an integer`);
    return n;
}
let _config = null;
function getConfig() {
    if (_config)
        return _config;
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
        paymentProvider: process.env['PAYMENT_PROVIDER'] || 'mock',
        paymentApiKey: optionalEnv('PAYMENT_API_KEY'),
        paymentApiSecret: optionalEnv('PAYMENT_API_SECRET'),
        platformCommissionPct: intEnv('PLATFORM_COMMISSION_PCT', 15),
        // SMS
        smsProvider: process.env['SMS_PROVIDER'] || 'mock',
        smsApiKey: optionalEnv('SMS_API_KEY'),
        // Maps
        googleMapsApiKey: optionalEnv('GOOGLE_MAPS_API_KEY'),
        // Bedrock
        bedrockRegion: process.env['BEDROCK_REGION'] || 'us-east-1',
        bedrockModelId: process.env['BEDROCK_MODEL_ID'] || 'anthropic.claude-3-sonnet-20240229-v1:0',
    };
    return _config;
}
// Reset for testing
function resetConfig() {
    _config = null;
}
//# sourceMappingURL=index.js.map