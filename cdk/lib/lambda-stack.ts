import {LambdaDeploymentGroup, LambdaDeploymentConfig} from '@aws-cdk/aws-codedeploy';
import { Function, Runtime, Code, CfnParametersCode, Alias} from '@aws-cdk/aws-lambda';
import { App, Stack, StackProps } from '@aws-cdk/core';

export class LambdaStack extends Stack {
  public readonly lambdaCode: CfnParametersCode;

  constructor(app: App, id: string, props?: StackProps) {
    super(app, id, props);

    this.lambdaCode = Code.fromCfnParameters();

    const func = new Function(this, 'Lambda', {
      code: this.lambdaCode,
      handler: 'index.main',
      runtime: Runtime.NODEJS_14_X,
      description: `Function generated on: ${new Date().toISOString()}`,
    });

    const alias = new Alias(this, 'LambdaAlias', {
      aliasName: 'Prod',
      version: func.currentVersion,
    });

    new LambdaDeploymentGroup(
      this,
      'DeploymentGroup',
      {
        alias,
        deploymentConfig:
          LambdaDeploymentConfig
            .LINEAR_10PERCENT_EVERY_1MINUTE,
      }
    );
  }
}
