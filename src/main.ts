import * as core from '@actions/core';
import {
  DataMigrationMode,
  DeploymentInput,
  DeploymentMode,
  DeploymentProgress,
  DeploymentRequest,
  DeploymentResponse,
  DeploymentStatus,
  NotificationType
} from '@sap-cx-actions/models';
import { DeploymentService } from '@sap-cx-actions/commerce-services';
import { Notifier } from '@sap-cx-actions/notifier';
import dayjs from 'dayjs';

export async function run(): Promise<void> {
  let deploymentCode: string | undefined;
  let deploymentStatus: DeploymentStatus | undefined;
  let deploymentProgress: DeploymentProgress;
  let deploymentResponse: DeploymentResponse;

  try {
    core.info('Triggering the CCv2 Cloud Deployment');
    const input: DeploymentInput = {
      token: core.getInput('token'),
      subscriptionCode: core.getInput('subscriptionCode'),
      buildCode: core.getInput('buildCode'),
      environmentCode: core.getInput('environmentCode'),
      databaseUpdateMode: core.getInput('databaseUpdateMode') as DataMigrationMode,
      deploymentMode: core.getInput('deploymentMode') as DeploymentMode,
      checkStatusInterval: parseInt(core.getInput('checkStatusInterval'), 10),
      retryOnFailure: core.getBooleanInput('retryOnFailure'),
      maxRetries: parseInt(core.getInput('maxRetries'), 10),
      notify: core.getBooleanInput('notify'),
      destination: core.getInput('destination')
    };

    const deploymentService = new DeploymentService(input.token, input.subscriptionCode);
    const shouldNotify = (): boolean => input.notify && input.destination !== '';
    const notifier = shouldNotify() ? new Notifier(input.destination) : null;

    // Create a new deployment
    const deploymentRequest: DeploymentRequest = {
      buildCode: input.buildCode,
      environmentCode: input.environmentCode,
      databaseUpdateMode: input.databaseUpdateMode,
      strategy: input.deploymentMode
    };

    deploymentResponse = await deploymentService.createDeployment(deploymentRequest);
    core.debug(`Create Deployment Response: ${JSON.stringify(deploymentResponse)}`);
    deploymentCode = deploymentResponse.code;

    // Get the deployment details
    if (deploymentCode) {
      deploymentResponse = await deploymentService.getDeployment(deploymentCode);
      core.debug(`Get Deployment Response: ${JSON.stringify(deploymentResponse)}`);
      deploymentStatus = deploymentResponse.status;

      if (notifier) {
        await notifier.notify(NotificationType.DEPLOYMENT_STARTED, deploymentResponse);
      }

      do {
        deploymentProgress = await deploymentService.getDeploymentProgress(deploymentCode);
        core.debug(`Deployment Progress: ${JSON.stringify(deploymentProgress)}`);

        if (
          deploymentProgress.deploymentStatus === DeploymentStatus.DEPLOYING &&
          deploymentProgress.percentage !== undefined &&
          deploymentProgress.percentage !== null &&
          deploymentProgress.percentage < 100
        ) {
          deploymentStatus = DeploymentStatus.DEPLOYING;
          console.log(
            `Deployment is in progress. ${deploymentProgress.percentage}% completed, waiting for ${input.checkStatusInterval}ms`
          );
          await new Promise(resolve => setTimeout(resolve, input.checkStatusInterval));
        } else if (deploymentProgress.deploymentStatus === DeploymentStatus.FAIL) {
          deploymentStatus = DeploymentStatus.FAIL;
          core.setFailed(`Deployment failed for the Build Code: ${deploymentResponse.code}`);
          deploymentProgress.deploymentStatus = DeploymentStatus.FAIL;
          if (notifier) {
            await notifier.notify(NotificationType.DEPLOYMENT_UNDEPLOYED, deploymentResponse);
          }
          break;
        } else if (deploymentProgress.deploymentStatus === DeploymentStatus.DEPLOYED) {
          deploymentStatus = DeploymentStatus.DEPLOYED;
          core.info(`Deployment completed successfully for the Build Code: ${deploymentResponse.code}`);
          if (notifier) {
            await notifier.notify(NotificationType.DEPLOYMENT_DEPLOYED, deploymentResponse);
          }
          break;
        }
      } while (deploymentProgress.deploymentStatus === DeploymentStatus.DEPLOYING);

      await core.summary
        .addHeading('SAP Commerce Cloud - Deployment Summary :sparkle:')
        .addTable([
          [
            { data: 'Deployment Code', header: true },
            { data: 'Build Code', header: true },
            { data: 'Environment Code', header: true },
            { data: 'Data Migration Mode', header: true },
            { data: 'Deployment Strategy', header: true },
            { data: 'Started', header: true }
          ],
          [
            deploymentResponse.code,
            deploymentResponse.buildCode,
            deploymentResponse.environmentCode,
            deploymentResponse.databaseUpdateMode,
            deploymentResponse.strategy,
            `${dayjs(deploymentResponse.createdTimestamp).format('MMMM DD, YYYY hh:mm:ss A')}`
          ]
        ])
        .addLink(
          'View in Cloud Portal',
          `https://portal.commerce.ondemand.com/subscription/${deploymentResponse.subscriptionCode}/applications/commerce-cloud/environments/${deploymentResponse.environmentCode}/deployments/${deploymentResponse.code}`
        )
        .write();
    }

    core.setOutput('deploymentCode', deploymentCode);
    core.setOutput('deploymentStatus', deploymentStatus);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
