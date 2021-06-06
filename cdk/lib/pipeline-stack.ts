import {
  LinuxBuildImage,
  PipelineProject,
  BuildSpec,
} from '@aws-cdk/aws-codebuild';
import {
  Pipeline,
  Artifact as PipelineArtifact,
} from '@aws-cdk/aws-codepipeline';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import {
  GitHubSourceAction,
  GitHubSourceActionProps,
  CodeBuildAction,
  CloudFormationCreateUpdateStackAction,
} from '@aws-cdk/aws-codepipeline-actions';
import { CfnParametersCode } from '@aws-cdk/aws-lambda';
import { App, Stack, StackProps } from '@aws-cdk/core';

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: CfnParametersCode;
  readonly repoOwner: GitHubSourceActionProps['owner'];
  readonly repoName: GitHubSourceActionProps['repo'];
  readonly repoBranch: GitHubSourceActionProps['branch'];
  readonly gitHubOAuthSecretCompleteArn: string;
}

export class PipelineStack extends Stack {
  constructor(app: App, id: string, props: PipelineStackProps) {
    super(app, id, props);

    const stackBuild = new PipelineProject(this, 'StackBuild', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['npm install -g yarn', 'yarn install'],
          },
          build: {
            commands: [
              'yarn run cdk synth -- -o dist',
            ],
          },
        },
        artifacts: {
          'base-directory': 'dist',
          files: ['LambdaStack.template.json'],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
      },
    });

    const lambdaBuild = new PipelineProject(
      this,
      'LambdaBuild',
      {
        buildSpec: BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              commands: 'yarn workspaces focus lambda',
            },
            build: {
              commands: 'yarn workspace lambda run build',
            },
          },
          artifacts: {
            'base-directory': 'packages/lambda',
            files: ['index.js', 'node_modules/**/*'],
          },
        }),
        environment: {
          buildImage: LinuxBuildImage.STANDARD_2_0,
        },
      }
    );

    const sourceOutput = new PipelineArtifact();

    const cdkBuildOutput = new PipelineArtifact(
      'CdkBuildOutput'
    );

    const lambdaBuildOutput = new PipelineArtifact(
      'LambdaBuildOutput'
    );

    const githubOAuthSecret = Secret.fromSecretCompleteArn(
      this,
      'GithubOAuthSecret',
      props.gitHubOAuthSecretCompleteArn
    );

    new Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new GitHubSourceAction({
              actionName: 'GitHub_Source',
              output: sourceOutput,
              owner: props.repoOwner,
              repo: props.repoName,
              branch: props.repoBranch,
              oauthToken: githubOAuthSecret.secretValue,
            }),
          ],
        },

        {
          stageName: 'Build',
          actions: [
            new CodeBuildAction({
              actionName: 'Lambda_Build',
              project: lambdaBuild,
              input: sourceOutput,
              outputs: [lambdaBuildOutput],
            }),
            new CodeBuildAction({
              actionName: 'CDK_Build',
              project: stackBuild,
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        },

        {
          stageName: 'Deploy',
          actions: [
            new CloudFormationCreateUpdateStackAction({
              actionName: 'Lambda_CFN_Deploy',
              templatePath: cdkBuildOutput.atPath(
                'LambdaStack.template.json'
              ),
              stackName: 'LambdaDeploymentStack',
              adminPermissions: true,
              parameterOverrides: {
                ...props.lambdaCode.assign(
                  lambdaBuildOutput.s3Location
                ),
              },
              extraInputs: [lambdaBuildOutput],
            }),
          ],
        },
      ],
    });
  }
}
