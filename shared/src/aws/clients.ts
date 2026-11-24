// ============================================================
// Parkly — AWS Client Factory
// Shared AWS client instances with credential management.
// ============================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { getConfig } from '../config';

function getAwsConfig() {
  const config = getConfig();
  return {
    region: config.awsRegion,
    ...(config.awsAccessKeyId && config.awsSecretAccessKey
      ? {
          credentials: {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
            ...(config.awsSessionToken
              ? { sessionToken: config.awsSessionToken }
              : {}),
          },
        }
      : {}), // Fall back to IAM role / instance profile in production
  };
}

// DynamoDB client (low-level)
let _dynamoClient: DynamoDBClient | null = null;
export function getDynamoClient(): DynamoDBClient {
  if (!_dynamoClient) {
    const config = getConfig();
    _dynamoClient = new DynamoDBClient({
      ...getAwsConfig(),
      ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
    });
  }
  return _dynamoClient;
}

// DynamoDB Document Client (high-level, auto-marshalling)
let _docClient: DynamoDBDocumentClient | null = null;
export function getDocClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(getDynamoClient(), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

// S3 Client
let _s3Client: S3Client | null = null;
export function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client(getAwsConfig());
  }
  return _s3Client;
}

// SNS Client
let _snsClient: SNSClient | null = null;
export function getSNSClient(): SNSClient {
  if (!_snsClient) {
    _snsClient = new SNSClient(getAwsConfig());
  }
  return _snsClient;
}

// EventBridge Client
let _eventBridgeClient: EventBridgeClient | null = null;
export function getEventBridgeClient(): EventBridgeClient {
  if (!_eventBridgeClient) {
    _eventBridgeClient = new EventBridgeClient(getAwsConfig());
  }
  return _eventBridgeClient;
}

/**
 * Publish an event to EventBridge.
 */
import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { ParklyEvent } from '../types';

export async function publishEvent<T>(event: ParklyEvent<T>): Promise<void> {
  const config = getConfig();
  const client = getEventBridgeClient();

  await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: config.eventBusName,
          Source: event.source,
          DetailType: event.type,
          Detail: JSON.stringify(event),
          Time: new Date(event.timestamp),
        },
      ],
    }),
  );
}
