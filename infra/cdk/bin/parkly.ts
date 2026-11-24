#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ParklyStack } from '../lib/parkly-stack';

const app = new cdk.App();

new ParklyStack(app, 'ParklyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Parkly — Smart Parking Marketplace Infrastructure',
  tags: {
    Project: 'Parkly',
    Environment: app.node.tryGetContext('env') || 'dev',
    ManagedBy: 'CDK',
  },
});

app.synth();
