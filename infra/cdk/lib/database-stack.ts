import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly otpTable: dynamodb.Table;
  public readonly occupancyTable: dynamodb.Table;
  public readonly notificationsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const prefix = `parkly-${isProd ? 'prod' : 'dev'}`;

    // ─── Secrets Manager Credentials ─────────────────────────
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${prefix}/rds/postgres`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'parkly' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      securityGroupName: `${prefix}-rds-sg`,
      description: 'Security group for Parkly PostgreSQL RDS',
    });

    // ─── PostgreSQL RDS ──────────────────────────────────────
    this.database = new rds.DatabaseInstance(this, 'ParklyDb', {
      instanceIdentifier: `${prefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: isProd
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'parkly',
      multiAz: isProd,
      storageEncrypted: true,
      deletionProtection: isProd,
      backupRetention: isProd ? cdk.Duration.days(7) : cdk.Duration.days(1),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── DynamoDB Tables ─────────────────────────────────────
    this.otpTable = new dynamodb.Table(this, 'OtpTable', {
      tableName: 'parkly-otp',
      partitionKey: { name: 'phone', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.occupancyTable = new dynamodb.Table(this, 'OccupancyTable', {
      tableName: 'parkly-occupancy',
      partitionKey: { name: 'spaceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: 'parkly-notifications',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.notificationsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'DbEndpoint', { value: this.database.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: this.dbSecret.secretArn });
    new cdk.CfnOutput(this, 'OtpTableName', { value: this.otpTable.tableName });
    new cdk.CfnOutput(this, 'OccupancyTableName', { value: this.occupancyTable.tableName });
    new cdk.CfnOutput(this, 'NotificationsTableName', { value: this.notificationsTable.tableName });
  }
}
