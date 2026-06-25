export interface AppConfig {
    nodeEnv: string;
    logLevel: string;
    cityDefault: string;
    jwtAccessSecret: string;
    jwtRefreshSecret: string;
    jwtAccessTtl: number;
    jwtRefreshTtl: number;
    awsRegion: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsSessionToken?: string;
    awsAccountId?: string;
    dynamoTableOtp: string;
    dynamoTableOccupancy: string;
    dynamoTableNotifications: string;
    dynamoEndpoint?: string;
    s3BucketUploads: string;
    s3BucketDatalake: string;
    snsSmsSenderId: string;
    eventBusName: string;
    paymentProvider: 'mock' | 'razorpay' | 'cashfree';
    paymentApiKey?: string;
    paymentApiSecret?: string;
    platformCommissionPct: number;
    smsProvider: 'mock' | 'twilio' | 'sns';
    smsApiKey?: string;
    googleMapsApiKey?: string;
    bedrockRegion: string;
    bedrockModelId: string;
}
export declare function getConfig(): AppConfig;
export declare function resetConfig(): void;
//# sourceMappingURL=index.d.ts.map