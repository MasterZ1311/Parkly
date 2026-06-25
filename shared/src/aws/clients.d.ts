import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
export declare function getDynamoClient(): DynamoDBClient;
export declare function getDocClient(): DynamoDBDocumentClient;
export declare function getS3Client(): S3Client;
export declare function getSNSClient(): SNSClient;
export declare function getEventBridgeClient(): EventBridgeClient;
import { ParklyEvent } from '../types';
export declare function publishEvent<T>(event: ParklyEvent<T>): Promise<void>;
//# sourceMappingURL=clients.d.ts.map