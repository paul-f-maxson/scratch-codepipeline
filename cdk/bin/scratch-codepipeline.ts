#!/usr/bin/env node
import { App } from '@aws-cdk/core';

import { LambdaStack } from '../lib/lambda-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const GITHUB_REPO_OWNER = 'paul-f-maxson';
const GITHUB_REPO_NAME = 'scratch-codepipeline';
const GITHUB_REPO_BRANCH = 'trunk';
const GITHUB_OAUTH_SECRET_COMPLETE_ARN =
  'arn:aws:secretsmanager:us-east-1:661928644946:secret:LedgerServicePipelineGitHubOAuthToken-jEVRK5';

const app = new App();

const lambdaStack = new LambdaStack(app, 'LambdaStack');

new PipelineStack(app, 'PipelineDeployingLambdaStack', {
  lambdaCode: lambdaStack.lambdaCode,
  repoOwner: GITHUB_REPO_OWNER,
  repoName: GITHUB_REPO_NAME,
  repoBranch: GITHUB_REPO_BRANCH,
  gitHubOAuthSecretCompleteArn: GITHUB_OAUTH_SECRET_COMPLETE_ARN,
});

app.synth();
