import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

// ============================================================
// Parkly — AWS CDK Infrastructure Stack
// Region: us-east-1 (primary) + ap-south-1 (India)
// ============================================================

export class ParklyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const prefix = `parkly-${isProd ? 'prod' : 'dev'}`;

    // ─── VPC ────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'ParklyVpc', {
      vpcName: `${prefix}-vpc`,
      cidr: isProd ? '10.10.0.0/16' : '10.20.0.0/16',
      maxAzs: 2,
      natGateways: 1,
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

    // ─── Secrets Manager ────────────────────────────────────
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `${prefix}/auth/jwt`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ algorithm: 'HS256' }),
        generateStringKey: 'secretKey',
        excludePunctuation: true,
      },
    });

    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${prefix}/rds/postgres`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'parkly' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // ─── RDS PostgreSQL ─────────────────────────────────────
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
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
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

    // ─── S3 Buckets ──────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${prefix}-uploads`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const dashboardHostingBucket = new s3.Bucket(this, 'DashboardHostingBucket', {
      bucketName: `${prefix}-dashboards`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── CloudFront CDN ──────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'DashboardDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(dashboardHostingBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });

    // ─── EventBridge & SNS ───────────────────────────────────
    const eventBus = new eventbridge.EventBus(this, 'ParklyEventBus', {
      eventBusName: 'parkly-event-bus',
    });

    const smsTopic = new sns.Topic(this, 'SmsTopic', {
      topicName: `${prefix}-sms`,
      displayName: 'Parkly SMS Notifications',
    });

    // ─── ECS Fargate & ALB ───────────────────────────────────
    const cluster = new ecs.Cluster(this, 'ParklyCluster', {
      vpc,
      clusterName: `${prefix}-ecs-cluster`,
    });

    // API Gateway Service behind Application Load Balancer
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'GatewayFargateService', {
      cluster,
      serviceName: `${prefix}-gateway-svc`,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: isProd ? 2 : 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('node:20-alpine'),
        containerPort: 4000,
        environment: {
          NODE_ENV: isProd ? 'production' : 'development',
          GATEWAY_PORT: '4000',
        },
      },
      publicLoadBalancer: true,
    });

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
    });

    // ─── Stack Outputs ───────────────────────────────────────
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'DbEndpoint', { value: database.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
    new cdk.CfnOutput(this, 'JwtSecretArn', { value: jwtSecret.secretArn });
    new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, 'DashboardCdnDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'GatewayAlbUrl', { value: fargateService.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'SmsTopicArn', { value: smsTopic.topicArn });
    new cdk.CfnOutput(this, 'OtpTableName', { value: otpTable.tableName });
    new cdk.CfnOutput(this, 'OccupancyTableName', { value: occupancyTable.tableName });
    new cdk.CfnOutput(this, 'NotificationsTableName', { value: notificationsTable.tableName });
  }
}
