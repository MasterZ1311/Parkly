import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';

export interface ParklyStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsServiceSg: ec2.ISecurityGroup;
  databaseStack: DatabaseStack;
}

interface InternalServiceConfig {
  id: string;
  name: string;
  port: number;
  portEnvVar: string;
  needsRds?: boolean;
  needsOtpTable?: boolean;
  needsOccupancyTable?: boolean;
  needsNotificationsTable?: boolean;
  needsUploadsBucket?: boolean;
  needsEvents?: boolean;
  needsSms?: boolean;
}

const INTERNAL_SERVICES: InternalServiceConfig[] = [
  { id: 'auth', name: 'auth-service', port: 4001, portEnvVar: 'AUTH_PORT', needsRds: true, needsOtpTable: true },
  { id: 'search', name: 'search-service', port: 4002, portEnvVar: 'SEARCH_PORT', needsRds: true },
  { id: 'booking', name: 'booking-service', port: 4003, portEnvVar: 'BOOKING_PORT', needsRds: true, needsEvents: true },
  { id: 'payment', name: 'payment-service', port: 4004, portEnvVar: 'PAYMENT_PORT', needsRds: true, needsEvents: true },
  { id: 'pricing', name: 'pricing-service', port: 4005, portEnvVar: 'PRICING_PORT', needsRds: true },
  { id: 'prediction', name: 'prediction-service', port: 4006, portEnvVar: 'PREDICTION_PORT', needsOccupancyTable: true },
  { id: 'occupancy', name: 'occupancy-service', port: 4008, portEnvVar: 'OCCUPANCY_PORT', needsOccupancyTable: true },
  { id: 'notification', name: 'notification-service', port: 4009, portEnvVar: 'NOTIFICATION_PORT', needsNotificationsTable: true, needsSms: true },
  { id: 'host', name: 'host-service', port: 4010, portEnvVar: 'HOST_PORT', needsRds: true, needsUploadsBucket: true, needsEvents: true },
  { id: 'admin', name: 'admin-service', port: 4011, portEnvVar: 'ADMIN_PORT', needsRds: true, needsEvents: true },
];

export class ParklyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ParklyStackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const imageTag = this.node.tryGetContext('imageTag') || 'latest';
    const prefix = `parkly-${isProd ? 'prod' : 'dev'}`;
    const { vpc, ecsServiceSg, databaseStack } = props;

    // ─── Application Secrets ────────────────────────────────
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `${prefix}/auth/jwt`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ algorithm: 'HS256' }),
        generateStringKey: 'secretKey',
        excludePunctuation: true,
        passwordLength: 48,
      },
    });

    const internalKeySecret = new secretsmanager.Secret(this, 'InternalServiceKeySecret', {
      secretName: `${prefix}/auth/internal-key`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'apiKey',
        excludePunctuation: true,
        passwordLength: 48,
      },
    });

    // ─── S3 Buckets ──────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${prefix}-uploads-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET],
          allowedOrigins: isProd ? ['https://*.parkly.in'] : ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const dashboardHostingBucket = new s3.Bucket(this, 'DashboardHostingBucket', {
      bucketName: `${prefix}-dashboards-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // ─── CloudFront CDN with Origin Access Control ──────────
    const distribution = new cloudfront.Distribution(this, 'DashboardDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(dashboardHostingBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ─── EventBridge & SNS ───────────────────────────────────
    const eventBus = new eventbridge.EventBus(this, 'ParklyEventBus', {
      eventBusName: `${prefix}-event-bus`,
    });

    const smsTopic = new sns.Topic(this, 'SmsTopic', {
      topicName: `${prefix}-sms`,
      displayName: 'Parkly SMS Notifications',
    });

    // ─── ECS Cluster & Service Discovery ────────────────────
    const cluster = new ecs.Cluster(this, 'ParklyCluster', {
      vpc,
      clusterName: `${prefix}-ecs-cluster`,
      containerInsightsV2: isProd ? ecs.ContainerInsights.ENHANCED : ecs.ContainerInsights.ENABLED,
    });

    const namespace = cluster.addDefaultCloudMapNamespace({
      name: 'parkly.local',
      type: servicediscovery.NamespaceType.DNS_PRIVATE,
    });

    const logGroup = new logs.LogGroup(this, 'ParklyServicesLogs', {
      logGroupName: `/ecs/${prefix}`,
      retention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── Internal Microservices (ECR + Cloud Map) ───────────
    for (const svc of INTERNAL_SERVICES) {
      const repo = new ecr.Repository(this, `${svc.id}EcrRepo`, {
        repositoryName: `${prefix}/${svc.name}`,
        imageScanOnPush: true,
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });

      const taskDef = new ecs.FargateTaskDefinition(this, `${svc.id}TaskDef`, {
        cpu: 256,
        memoryLimitMiB: 512,
      });

      taskDef.addContainer(`${svc.id}Container`, {
        image: ecs.ContainerImage.fromEcrRepository(repo, imageTag),
        portMappings: [{ containerPort: svc.port }],
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: svc.id, logGroup }),
        environment: {
          NODE_ENV: isProd ? 'production' : 'development',
          AWS_REGION: cdk.Aws.REGION,
          [svc.portEnvVar]: String(svc.port),
          S3_BUCKET_UPLOADS: uploadsBucket.bucketName,
          DYNAMO_OTP_TABLE: databaseStack.otpTable.tableName,
          DYNAMO_OCCUPANCY_TABLE: databaseStack.occupancyTable.tableName,
          DYNAMO_NOTIFICATIONS_TABLE: databaseStack.notificationsTable.tableName,
          EVENTBRIDGE_BUS_NAME: eventBus.eventBusName,
          SNS_SMS_TOPIC_ARN: smsTopic.topicArn,
          SEARCH_SERVICE_URL: 'http://search.parkly.local:4002',
          PRICING_SERVICE_URL: 'http://pricing.parkly.local:4005',
          BOOKING_SERVICE_URL: 'http://booking.parkly.local:4003',
          PAYMENT_SERVICE_URL: 'http://payment.parkly.local:4004',
          NOTIFICATION_SERVICE_URL: 'http://notification.parkly.local:4009',
          OCCUPANCY_SERVICE_URL: 'http://occupancy.parkly.local:4008',
          PREDICTION_SERVICE_URL: 'http://prediction.parkly.local:4006',
        },
        secrets: {
          JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret, 'secretKey'),
          INTERNAL_SERVICE_KEY: ecs.Secret.fromSecretsManager(internalKeySecret, 'apiKey'),
          ...(svc.needsRds
            ? { DB_SECRET_JSON: ecs.Secret.fromSecretsManager(databaseStack.dbSecret) }
            : {}),
        },
        healthCheck: {
          command: ['CMD-SHELL', `wget -qO- http://localhost:${svc.port}/health || exit 1`],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          retries: 3,
        },
      });

      jwtSecret.grantRead(taskDef.taskRole);
      internalKeySecret.grantRead(taskDef.taskRole);
      if (svc.needsRds) databaseStack.dbSecret.grantRead(taskDef.taskRole);
      if (svc.needsOtpTable) databaseStack.otpTable.grantReadWriteData(taskDef.taskRole);
      if (svc.needsOccupancyTable) databaseStack.occupancyTable.grantReadWriteData(taskDef.taskRole);
      if (svc.needsNotificationsTable) databaseStack.notificationsTable.grantReadWriteData(taskDef.taskRole);
      if (svc.needsUploadsBucket) uploadsBucket.grantReadWrite(taskDef.taskRole);
      if (svc.needsEvents) eventBus.grantPutEventsTo(taskDef.taskRole);
      if (svc.needsSms) smsTopic.grantPublish(taskDef.taskRole);

      new ecs.FargateService(this, `${svc.id}FargateService`, {
        cluster,
        serviceName: `${prefix}-${svc.name}`,
        taskDefinition: taskDef,
        desiredCount: isProd ? 2 : 1,
        securityGroups: [ecsServiceSg],
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        cloudMapOptions: {
          name: svc.id,
          cloudMapNamespace: namespace,
        },
      });
    }

    // ─── API Gateway Fargate Service behind ALB ──────────────
    const gatewayRepo = new ecr.Repository(this, 'GatewayEcrRepo', {
      repositoryName: `${prefix}/api-gateway`,
      imageScanOnPush: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'GatewayFargateService', {
      cluster,
      serviceName: `${prefix}-gateway-svc`,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: isProd ? 2 : 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(gatewayRepo, imageTag),
        containerPort: 4000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'gateway', logGroup }),
        environment: {
          NODE_ENV: isProd ? 'production' : 'development',
          GATEWAY_PORT: '4000',
          AUTH_SERVICE_URL: 'http://auth.parkly.local:4001',
          SEARCH_SERVICE_URL: 'http://search.parkly.local:4002',
          BOOKING_SERVICE_URL: 'http://booking.parkly.local:4003',
          PAYMENT_SERVICE_URL: 'http://payment.parkly.local:4004',
          PRICING_SERVICE_URL: 'http://pricing.parkly.local:4005',
          PREDICTION_SERVICE_URL: 'http://prediction.parkly.local:4006',
          OCCUPANCY_SERVICE_URL: 'http://occupancy.parkly.local:4008',
          NOTIFICATION_SERVICE_URL: 'http://notification.parkly.local:4009',
          HOST_SERVICE_URL: 'http://host.parkly.local:4010',
          ADMIN_SERVICE_URL: 'http://admin.parkly.local:4011',
        },
        secrets: {
          JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret, 'secretKey'),
          INTERNAL_SERVICE_KEY: ecs.Secret.fromSecretsManager(internalKeySecret, 'apiKey'),
        },
      },
      publicLoadBalancer: true,
    });

    // Allow Gateway tasks to call internal microservices without creating cross-stack cycles
    const gatewaySg = fargateService.service.connections.securityGroups[0];
    if (gatewaySg) {
      new ec2.CfnSecurityGroupIngress(this, 'AllowGatewayToInternalEcs', {
        groupId: ecsServiceSg.securityGroupId,
        ipProtocol: 'tcp',
        fromPort: 4001,
        toPort: 4011,
        sourceSecurityGroupId: gatewaySg.securityGroupId,
        description: 'Allow API Gateway Fargate tasks to proxy to internal microservices',
      });
    }

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
    });

    // ─── Gateway Auto-Scaling Policies ───────────────────────
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: isProd ? 2 : 1,
      maxCapacity: isProd ? 10 : 3,
    });

    scaling.scaleOnCpuUtilization('GatewayCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('GatewayMemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnRequestCount('GatewayRequestScaling', {
      requestsPerTarget: 1000,
      targetGroup: fargateService.targetGroup,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ─── Stack Outputs ───────────────────────────────────────
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'DbEndpoint', { value: databaseStack.database.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: databaseStack.dbSecret.secretArn });
    new cdk.CfnOutput(this, 'JwtSecretArn', { value: jwtSecret.secretArn });
    new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, 'DashboardCdnDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'GatewayAlbUrl', { value: fargateService.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'SmsTopicArn', { value: smsTopic.topicArn });
  }
}
