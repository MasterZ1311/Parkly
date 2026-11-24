"use strict";
// ============================================================
// Parkly — AWS Client Factory
// Shared AWS client instances with credential management.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamoClient = getDynamoClient;
exports.getDocClient = getDocClient;
exports.getS3Client = getS3Client;
exports.getSNSClient = getSNSClient;
exports.getEventBridgeClient = getEventBridgeClient;
exports.publishEvent = publishEvent;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sns_1 = require("@aws-sdk/client-sns");
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const config_1 = require("../config");
function getAwsConfig() {
    const config = (0, config_1.getConfig)();
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
let _dynamoClient = null;
function getDynamoClient() {
    if (!_dynamoClient) {
        const config = (0, config_1.getConfig)();
        _dynamoClient = new client_dynamodb_1.DynamoDBClient({
            ...getAwsConfig(),
            ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
        });
    }
    return _dynamoClient;
}
// DynamoDB Document Client (high-level, auto-marshalling)
let _docClient = null;
function getDocClient() {
    if (!_docClient) {
        _docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(getDynamoClient(), {
            marshallOptions: { removeUndefinedValues: true },
        });
    }
    return _docClient;
}
// S3 Client
let _s3Client = null;
function getS3Client() {
    if (!_s3Client) {
        _s3Client = new client_s3_1.S3Client(getAwsConfig());
    }
    return _s3Client;
}
// SNS Client
let _snsClient = null;
function getSNSClient() {
    if (!_snsClient) {
        _snsClient = new client_sns_1.SNSClient(getAwsConfig());
    }
    return _snsClient;
}
// EventBridge Client
let _eventBridgeClient = null;
function getEventBridgeClient() {
    if (!_eventBridgeClient) {
        _eventBridgeClient = new client_eventbridge_1.EventBridgeClient(getAwsConfig());
    }
    return _eventBridgeClient;
}
/**
 * Publish an event to EventBridge.
 */
const client_eventbridge_2 = require("@aws-sdk/client-eventbridge");
async function publishEvent(event) {
    const config = (0, config_1.getConfig)();
    const client = getEventBridgeClient();
    await client.send(new client_eventbridge_2.PutEventsCommand({
        Entries: [
            {
                EventBusName: config.eventBusName,
                Source: event.source,
                DetailType: event.type,
                Detail: JSON.stringify(event),
                Time: new Date(event.timestamp),
            },
        ],
    }));
}
//# sourceMappingURL=clients.js.map