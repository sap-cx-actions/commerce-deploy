import { run } from '../src/main';
import { DeploymentService } from '@sap-cx-actions/commerce-services';
import { Notifier } from '@sap-cx-actions/notifier';
import {
  DataMigrationMode,
  DeploymentMode,
  DeploymentRequest,
  DeploymentResponse,
  DeploymentStatus
} from '@sap-cx-actions/models';
import * as core from '@actions/core';

jest.mock('@sap-cx-actions/commerce-services');
jest.mock('@sap-cx-actions/notifier');
jest.mock('@actions/core');

describe('main', () => {
  let getInputMock: jest.SpyInstance;
  let getBooleanInputMock: jest.SpyInstance;
  let setOutputMock: jest.SpyInstance;
  let setFailedMock: jest.SpyInstance;
  let deploymentServiceMock: jest.Mocked<DeploymentService>;
  let notifierMock: jest.Mocked<Notifier>;

  beforeEach(() => {
    getInputMock = jest.spyOn(core, 'getInput');
    getBooleanInputMock = jest.spyOn(core, 'getBooleanInput');
    setOutputMock = jest.spyOn(core, 'setOutput');
    setFailedMock = jest.spyOn(core, 'setFailed');
    deploymentServiceMock = new DeploymentService('test-token', 'test-subscription') as jest.Mocked<DeploymentService>;
    notifierMock = new Notifier('') as jest.Mocked<Notifier>;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should trigger the deployment and set outputs', async () => {
    getInputMock.mockImplementation((name: string) => {
      const inputs: { [key: string]: string } = {
        token: 'test-token',
        subscriptionCode: 'test-subscription',
        buildCode: 'test-build-code',
        environmentCode: 'test-environment',
        databaseUpdateMode: 'FULL',
        deploymentMode: 'BLUE_GREEN',
        checkStatusInterval: '10',
        retryOnFailure: 'false',
        maxRetries: '3',
        notify: 'false',
        destination: ''
      };
      return inputs[name];
    });

    getBooleanInputMock.mockImplementation((name: string) => {
      const inputs: { [key: string]: boolean } = {
        retryOnFailure: false,
        notify: false
      };
      return inputs[name];
    });

    const deploymentResponse: DeploymentResponse = {
      code: 'new-code',
      subscriptionCode: 'new-subscription-code',
      createdBy: 'new-created-by',
      createdTimestamp: new Date(),
      buildCode: 'new-build-code',
      environmentCode: 'new-environment-code',
      databaseUpdateMode: DataMigrationMode.UPDATE,
      strategy: DeploymentMode.RECREATE,
      scheduledTimestamp: new Date(),
      deployedTimestamp: null,
      failedTimestamp: null,
      undeployedTimestamp: null,
      status: DeploymentStatus.DEPLOYING,
      canceledBy: null,
      canceledTimestamp: null,
      cancellationFinishedTimestamp: null,
      cancellationFailed: null,
      cancelation: null,
      isCanaryAvailable: false,
      previousDeploymentCode: null,
      expireAtTimestamp: null,
      canaryStatus: null,
      trafficSplit: null
    };

    deploymentServiceMock.createDeployment.mockResolvedValue(deploymentResponse);
    deploymentServiceMock.getDeployment.mockResolvedValue(deploymentResponse);

    await run();

    expect(deploymentServiceMock.createDeployment).toHaveBeenCalledWith({
      buildCode: 'test-build-code',
      environmentCode: 'test-environment',
      databaseUpdateMode: DataMigrationMode.UPDATE,
      strategy: DeploymentMode.RECREATE
    } as DeploymentRequest);
    expect(deploymentServiceMock.getDeployment).toHaveBeenCalledWith('deployment-code');
    expect(setOutputMock).toHaveBeenCalledWith('deploymentCode', 'deployment-code');
    expect(setOutputMock).toHaveBeenCalledWith('deploymentStatus', DeploymentStatus.DEPLOYING);
  });

  it('should handle errors during deployment process', async () => {
    getInputMock.mockImplementation((name: string) => {
      const inputs: { [key: string]: string } = {
        token: 'test-token',
        subscriptionCode: 'test-subscription',
        buildCode: 'test-build-code',
        environmentCode: 'test-environment',
        databaseUpdateMode: 'FULL',
        deploymentMode: 'BLUE_GREEN',
        checkStatusInterval: '10',
        retryOnFailure: 'false',
        maxRetries: '3',
        notify: 'false',
        destination: ''
      };
      return inputs[name];
    });

    getBooleanInputMock.mockImplementation((name: string) => {
      const inputs: { [key: string]: boolean } = {
        retryOnFailure: false,
        notify: false
      };
      return inputs[name];
    });

    const error = new Error('Deployment failed');
    deploymentServiceMock.createDeployment.mockRejectedValue(error);

    await run();

    expect(setFailedMock).toHaveBeenCalledWith('Deployment failed');
  });
});
