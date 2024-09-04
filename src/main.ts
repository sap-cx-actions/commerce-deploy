import * as core from '@actions/core';
import {
  NotificationType,
  DeploymentStatus,
  DataMigrationMode,
  DeploymentMode,
  DeploymentRequest,
  DeploymentResponse,
  DeploymentInput
} from '@sap-cx-actions/models';
import { DeploymentService } from '@sap-cx-actions/commerce-services';
import { Notifier } from '@sap-cx-actions/notifier';
import dayjs from 'dayjs';

export async function run(): Promise<void> {
  let deploymentCode: string | undefined;
  let deploymentStatus: DeploymentStatus | undefined;

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
    const notifier = new Notifier(input.destination);

    // Create a new deployment
    const deploymentRequest: DeploymentRequest = {
      buildCode: input.buildCode,
      environmentCode: input.environmentCode,
      databaseUpdateMode: input.databaseUpdateMode,
      strategy: input.deploymentMode
    };

    const deploymentResponse: DeploymentResponse = await deploymentService.createDeployment(deploymentRequest);
    core.debug(`Create Deployment Response: ${JSON.stringify(deploymentResponse, null, 2)}`);
    deploymentCode = deploymentResponse.code;

    // Get the deployment details
    if (deploymentCode) {
      const getDeployment: DeploymentResponse = await deploymentService.getDeployment(deploymentCode);
      core.debug(`Get Deployment Response: ${JSON.stringify(getDeployment, null, 2)}`);
      deploymentStatus = getDeployment.status;

      if (input.notify && input.destination) {
        core.debug('Sending notification...');
        //await notifier.notify(NotificationType.DEPLOYMENT_STARTED, getDeployment);
      }

      const deploymentProgress = await deploymentService.getDeploymentProgress(deploymentCode);
      core.debug(`Deployment Progress: ${JSON.stringify(deploymentProgress, null, 2)}`);

      await core.summary
        .addHeading('SAP Commerce Cloud - Deployment Summary :sparkle:')
        .addTable([
          [
            { data: 'Deployment Code', header: true },
            { data: 'Build Code', header: true },
            { data: 'Data Migration Mode', header: true },
            { data: 'Deployment Strategy', header: true },
            { data: 'Started', header: true }
          ],
          [
            getDeployment.code,
            getDeployment.buildCode,
            getDeployment.databaseUpdateMode,
            getDeployment.strategy,
            `${dayjs(getDeployment.createdTimestamp).format('MMMM DD, YYYY hh:mm:ss A')}`
          ]
        ])
        .addLink('View in Cloud Portal', 'https://portal.commerce.ondemand.com')
        .write();
    }

    core.setOutput('deploymentCode', deploymentCode);
    core.setOutput('deploymentStatus', deploymentStatus);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
