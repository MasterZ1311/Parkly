import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

// ============================================================
// Parkly — AWS CDK Infrastructure Stack
// Region: us-east-1 (primary) + ap-south-1 (India/future)
// ============================================================

export class ParklyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const prefix = `parkly-${isProd ? 'prod' : 'dev'}`;

    // ─── VPC ────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'ParklyVpc', {
      vpcName: `${prefix}-vpc`,
      maxAzs: isProd ? 3 : 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // ─── RDS PostgreSQL ─────────────────────────────────────
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${prefix}/rds/postgres`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'parkly' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      securityGroupName: `${prefix}-rds-sg`,
      description: 'Security group for Parkly RDS',
    });

    const database = new rds.DatabaseInstance(this, 'ParklyDb', {
      instanceIdentifier: `${prefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: isProd
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'parkly',
      multiAz: isProd,
      storageEncrypted: true,
      deletionProtection: isProd,
      backupRetention: isProd ? cdk.Duration.days(7) : cdk.Duration.days(1),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── DynamoDB Tables ────────────────────────────────────
    const otpTable = new dynamodb.Table(this, 'OtpTable', {
      tableName: 'parkly-otp',
      partitionKey: { name: 'phone', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const occupancyTable = new dynamodb.Table(this, 'OccupancyTable', {
      tableName: 'parkly-occupancy',
      partitionKey: { name: 'spaceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: 'parkly-notifications',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying notifications by userId + type
    notificationsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── S3 Buckets ──────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${prefix}-uploads`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [
        {
          id: 'delete-temp-uploads',
          prefix: 'temp/',
          expiration: cdk.Duration.days(7),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Restrict to your domain in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const datalakeBucket = new s3.Bucket(this, 'DatalakeBucket', {
      bucketName: `${prefix}-datalake`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── EventBridge Event Bus ───────────────────────────────
    const eventBus = new eventbridge.EventBus(this, 'ParklyEventBus', {
      eventBusName: 'parkly-event-bus',
    });

    // ─── SNS Topics (SMS via AWS SNS) ────────────────────────
    const smsTopic = new sns.Topic(this, 'SmsTopic', {
      topicName: `${prefix}-sms`,
      displayName: 'Parkly SMS Notifications',
    });

    // ─── Outputs ─────────────────────────────────────────────
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'DbEndpoint', { value: database.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
    new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, 'DatalakeBucketName', { value: datalakeBucket.bucketName });
    new cdk.CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'SmsTopicArn', { value: smsTopic.topicArn });
    new cdk.CfnOutput(this, 'OtpTableName', { value: otpTable.tableName });
    new cdk.CfnOutput(this, 'OccupancyTableName', { value: occupancyTable.tableName });
    new cdk.CfnOutput(this, 'NotificationsTableName', { value: notificationsTable.tableName });
  }
}
