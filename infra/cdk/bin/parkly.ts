#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ParklyStack } from '../lib/parkly-stack';

const app = new cdk.App();
const envName = app.node.tryGetContext('env') || 'dev';

const stackEnv: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const commonTags = {
  Project: 'Parkly',
  Environment: envName,
  ManagedBy: 'CDK',
};

const networkStack = new NetworkStack(app, 'ParklyNetworkStack', {
  env: stackEnv,
  description: 'Parkly — VPC & Networking Infrastructure',
  tags: commonTags,
});

const databaseStack = new DatabaseStack(app, 'ParklyDatabaseStack', {
  env: stackEnv,
  vpc: networkStack.vpc,
  ecsServiceSg: networkStack.ecsServiceSg,
  description: 'Parkly — RDS PostgreSQL & DynamoDB Data Layer',
  tags: commonTags,
});
databaseStack.addStackDependency(networkStack);

const parklyStack = new ParklyStack(app, 'ParklyStack', {
  env: stackEnv,
  vpc: networkStack.vpc,
  ecsServiceSg: networkStack.ecsServiceSg,
  databaseStack,
  description: 'Parkly — ECS Microservices, API Gateway & CDN Infrastructure',
  tags: commonTags,
});
parklyStack.addStackDependency(databaseStack);

app.synth();
