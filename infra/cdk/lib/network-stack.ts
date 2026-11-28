import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsServiceSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const prefix = `parkly-${isProd ? 'prod' : 'dev'}`;

    this.vpc = new ec2.Vpc(this, 'ParklyVpc', {
      vpcName: `${prefix}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(isProd ? '10.10.0.0/16' : '10.20.0.0/16'),
      maxAzs: 2,
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

    this.ecsServiceSg = new ec2.SecurityGroup(this, 'EcsServicesSg', {
      vpc: this.vpc,
      securityGroupName: `${prefix}-ecs-sg`,
      description: 'Security group for Parkly ECS Fargate microservices',
    });
    this.ecsServiceSg.addIngressRule(
      this.ecsServiceSg,
      ec2.Port.allTcp(),
      'Allow internal microservice traffic inside VPC',
    );

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, 'EcsSecurityGroupId', { value: this.ecsServiceSg.securityGroupId });
  }
}
