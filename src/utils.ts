import * as core from '@actions/core';
import { DeploymentResponse } from '@sap-cx-actions/models';
import dayjs from 'dayjs';
import { SAP } from '@sap-cx-actions/commerce-services/src/constants';

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
