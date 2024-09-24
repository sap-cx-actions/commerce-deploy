import * as core from '@actions/core';
import { DataMigrationMode, DeploymentInput, DeploymentMode, DeploymentResponse } from '@sap-cx-actions/models';
import dayjs from 'dayjs';
import { SAP } from '@sap-cx-actions/commerce-services/src/constants';

export const getInputs: DeploymentInput = {
  token: process.env.SAP_CCV2_API_TOKEN || '',
  subscriptionCode: process.env.SAP_CCV2_SUB_CODE || '',
  buildCode: core.getInput('buildCode', { required: true }),
  environmentCode: core.getInput('environmentCode'),
  databaseUpdateMode: core.getInput('databaseUpdateMode') as DataMigrationMode,
  deploymentMode: core.getInput('deploymentMode') as DeploymentMode,
  checkStatusInterval: parseInt(core.getInput('checkStatusInterval'), 10),
  retryOnFailure: false,
  maxRetries: 3,
  notify: core.getBooleanInput('notify'),
  webhookUrl: process.env.WEBHOOK_URL || '',
  dryRun: core.getBooleanInput('dryRun')
};

export function validateInputs(inputs: { [key: string]: string }): void {
  const errorMessages: string[] = [];

  for (const [key, value] of Object.entries(inputs)) {
    if (!value) {
      const errorMessage = `'${key}' is required.`;
      errorMessages.push(errorMessage);
    }
  }

  if (errorMessages.length > 0) {
    const errorMessage = `Validation Failed: ${errorMessages.join(', ')}`;
    throw new Error(errorMessage);
  }
}

export async function addSummary(deploymentResponse: DeploymentResponse): Promise<void> {
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
        `${dayjs(deploymentResponse.createdTimestamp).format(SAP.CX.Actions.DATE_FORMAT)}`
      ]
    ])
    .addLink(
      'View in Cloud Portal',
      SAP.CX.Actions.CLOUD_PORTAL_URL +
        `/subscription/${deploymentResponse.subscriptionCode}/applications/commerce-cloud/environments/${deploymentResponse.environmentCode}/deployments/${deploymentResponse.code}`
    )
    .write();
}
