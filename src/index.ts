import * as core from '@actions/core';
import {
  DeploymentProgress,
  DeploymentRequest,
  DeploymentResponse,
  DeploymentStatus,
  NotificationType
} from '@sap-cx-actions/models';
import { DeploymentService } from '@sap-cx-actions/commerce-services';
import { Notifier } from '@sap-cx-actions/notifier';
import { addSummary, buildNotification, getInputs, validateInputs } from './utils';

export async function run(): Promise<void> {
  let deploymentCode: string | undefined;
  let deploymentStatus: DeploymentStatus | undefined;
  let deploymentProgress: DeploymentProgress;
  let deploymentResponse: DeploymentResponse;

  try {
    core.info('Triggering the CCv2 Cloud Deployment');
    const input = getInputs;

    // Validate required inputs
    validateInputs({ token: input.token, subscriptionCode: input.subscriptionCode });

    const deploymentService = new DeploymentService(input.token, input.subscriptionCode, input.dryRun);
    const shouldNotify = (): boolean => input.notify && input.webhookUrl !== '';
    const notifier = shouldNotify() ? new Notifier(input.webhookUrl) : null;

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
        await notifier.notify(buildNotification(NotificationType.DEPLOYMENT_STARTED, deploymentResponse));
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
            await notifier.notify(buildNotification(NotificationType.DEPLOYMENT_FAILED, deploymentResponse));
          }
          break;
        } else if (deploymentProgress.deploymentStatus === DeploymentStatus.DEPLOYED) {
          deploymentStatus = DeploymentStatus.DEPLOYED;
          core.info(`Deployment completed successfully for the Build Code: ${deploymentResponse.code}`);
          if (notifier) {
            await notifier.notify(buildNotification(NotificationType.DEPLOYMENT_DEPLOYED, deploymentResponse));
          }
          break;
        }
      } while (deploymentProgress.deploymentStatus === DeploymentStatus.DEPLOYING);

      await addSummary(deploymentResponse);
    }

    core.setOutput('deploymentCode', deploymentCode);
    core.setOutput('deploymentStatus', deploymentStatus);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
  .then(r => r)
  .catch(e => core.setFailed(e));
