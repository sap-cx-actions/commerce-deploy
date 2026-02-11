import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  DataMigrationMode,
  DeploymentMode,
  DeploymentProgress,
  DeploymentResponse,
  DeploymentStatus,
  NotificationType
} from '@sap-cx-actions/models';

const flushPromises = () => Promise.resolve();
const flushImmediate = () => new Promise(resolve => setImmediate(resolve));

const baseEnv: Record<string, string> = {
  SAP_CCV2_API_TOKEN: 'token-1',
  SAP_CCV2_SUB_CODE: 'sub-1',
  SAP_CCV2_TOKEN_ENDPOINT: 'https://tokens.example.test',
  SAP_CCV2_CLIENT_ID: 'client-1',
  SAP_CCV2_CLIENT_SECRET: 'secret-1',
  SAP_CCV2_RESOURCE: 'resource-1',
  WEBHOOK_URL: 'https://hooks.example.test',
  INPUT_BUILDCODE: 'build-1',
  INPUT_ENVIRONMENTCODE: 'env-1',
  INPUT_DATABASEUPDATEMODE: DataMigrationMode.UPDATE,
  INPUT_DEPLOYMENTMODE: DeploymentMode.ROLLING_UPDATE,
  INPUT_CHECKSTATUSINTERVAL: '1000',
  INPUT_NOTIFY: 'true',
  INPUT_DRYRUN: 'false',
  INPUT_TIMEZONE: 'UTC',
  GITHUB_REPOSITORY: 'octo/repo',
  GITHUB_RUN_ID: '42',
  GITHUB_SERVER_URL: 'https://github.com'
};

const envKeys = new Set<string>();

const setEnv = (overrides: Record<string, string | undefined> = {}) => {
  const merged = { ...baseEnv, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    envKeys.add(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const createSummaryFile = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'commerce-deploy-'));
  const filePath = path.join(dir, 'summary.md');
  await fs.writeFile(filePath, '');
  process.env.GITHUB_STEP_SUMMARY = filePath;
  envKeys.add('GITHUB_STEP_SUMMARY');
  return { dir, filePath };
};

const setupIndexRun = async (overrides: Record<string, string | undefined> = {}) => {
  jest.resetModules();
  setEnv(overrides);
  const summaryFile = await createSummaryFile();

  const core = await import('@actions/core');
  const commerceServices = await import('@sap-cx-actions/commerce-services');
  const notifierModule = await import('@sap-cx-actions/notifier');

  const createDeployment = jest.spyOn(commerceServices.DeploymentService.prototype, 'createDeployment');
  const getDeployment = jest.spyOn(commerceServices.DeploymentService.prototype, 'getDeployment');
  const getDeploymentProgress = jest.spyOn(commerceServices.DeploymentService.prototype, 'getDeploymentProgress');
  const notify = jest.spyOn(notifierModule.Notifier.prototype, 'notify').mockResolvedValue(undefined);

  const setFailed = jest.spyOn(core, 'setFailed').mockImplementation(() => undefined);
  const info = jest.spyOn(core, 'info').mockImplementation(() => undefined);
  const debug = jest.spyOn(core, 'debug').mockImplementation(() => undefined);
  const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

  return {
    summaryFile,
    createDeployment,
    getDeployment,
    getDeploymentProgress,
    notify,
    setFailed,
    info,
    debug,
    stdoutWrite
  };
};

afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await fs.rm(path.dirname(summaryPath), { recursive: true, force: true });
  }
  for (const key of envKeys) {
    delete process.env[key];
  }
  envKeys.clear();
});

describe('run', () => {
  it('handles deploy progress and notifies on success', async () => {
    jest.useFakeTimers();
    const { createDeployment, getDeployment, getDeploymentProgress, notify } = await setupIndexRun();

    const deploymentResponse = {
      code: 'dep-1',
      status: DeploymentStatus.DEPLOYING,
      buildCode: 'build-1',
      environmentCode: 'env-1',
      databaseUpdateMode: DataMigrationMode.UPDATE,
      strategy: DeploymentMode.ROLLING_UPDATE,
      subscriptionCode: 'sub-1',
      createdTimestamp: new Date('2024-01-01T00:00:00.000Z')
    } as unknown as DeploymentResponse;

    createDeployment.mockResolvedValue(deploymentResponse);
    getDeployment.mockResolvedValue(deploymentResponse);

    const deployingProgress = {
      deploymentStatus: DeploymentStatus.DEPLOYING,
      percentage: 50
    } as unknown as DeploymentProgress;
    const deployedProgress = {
      deploymentStatus: DeploymentStatus.DEPLOYED,
      percentage: 100
    } as unknown as DeploymentProgress;

    getDeploymentProgress.mockResolvedValueOnce(deployingProgress).mockResolvedValueOnce(deployedProgress);

    await import('../src/index');

    await flushPromises();
    await jest.runAllTimersAsync();
    await flushPromises();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.DEPLOYMENT_STARTED }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.DEPLOYMENT_DEPLOYED }));
  });

  it('handles failed deployment and notifies', async () => {
    const { createDeployment, getDeployment, getDeploymentProgress, notify, setFailed } = await setupIndexRun();

    const deploymentResponse = {
      code: 'dep-2',
      status: DeploymentStatus.DEPLOYING,
      buildCode: 'build-2',
      environmentCode: 'env-2',
      databaseUpdateMode: DataMigrationMode.UPDATE,
      strategy: DeploymentMode.ROLLING_UPDATE,
      subscriptionCode: 'sub-2',
      createdTimestamp: new Date('2024-01-01T00:00:00.000Z')
    } as unknown as DeploymentResponse;

    createDeployment.mockResolvedValue(deploymentResponse);
    getDeployment.mockResolvedValue(deploymentResponse);

    const failedProgress = {
      deploymentStatus: DeploymentStatus.FAIL
    } as unknown as DeploymentProgress;
    getDeploymentProgress.mockResolvedValue(failedProgress);

    await import('../src/index');

    await flushImmediate();

    expect(setFailed).toHaveBeenCalledWith('Deployment failed for the Build Code: dep-2');
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.DEPLOYMENT_FAILED,
        content: expect.objectContaining({ code: 'dep-2' })
      })
    );
  });

  it('skips deployment flow when deployment code is missing', async () => {
    const { createDeployment, notify } = await setupIndexRun({
      INPUT_NOTIFY: 'false',
      WEBHOOK_URL: ''
    });

    createDeployment.mockResolvedValue({ code: undefined } as unknown as DeploymentResponse);

    await import('../src/index');

    await flushImmediate();

    expect(notify).not.toHaveBeenCalled();
  });

  it('handles validation errors and sets failed', async () => {
    const { setFailed } = await setupIndexRun({
      SAP_CCV2_CLIENT_ID: '',
      SAP_CCV2_CLIENT_SECRET: '',
      SAP_CCV2_SUB_CODE: '',
      INPUT_NOTIFY: 'false',
      WEBHOOK_URL: ''
    });

    await import('../src/index');

    await flushImmediate();

    expect(setFailed).toHaveBeenCalledWith(
      "Validation Failed: 'clientId' is required., 'clientSecret' is required., 'subscriptionCode' is required."
    );
  });

  it('routes unhandled rejection to top-level catch', async () => {
    let callCount = 0;
    const { setFailed } = await setupIndexRun({
      SAP_CCV2_CLIENT_ID: '',
      SAP_CCV2_CLIENT_SECRET: '',
      SAP_CCV2_SUB_CODE: ''
    });
    setFailed.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('setFailed exploded');
      }
    });

    await import('../src/index');

    await flushImmediate();

    expect(setFailed).toHaveBeenCalledTimes(2);
  });

  it('ignores non-error rejections in run', async () => {
    const { createDeployment, setFailed } = await setupIndexRun();

    createDeployment.mockRejectedValue('boom');

    await import('../src/index');

    await flushImmediate();

    expect(setFailed).not.toHaveBeenCalled();
  });

  it('handles deployment errors with Error instances', async () => {
    const { createDeployment, setFailed } = await setupIndexRun();

    createDeployment.mockRejectedValue(new Error('deploy exploded'));

    await import('../src/index');

    await flushImmediate();

    expect(setFailed).toHaveBeenCalledWith('deploy exploded');
  });

  it('skips notifier when webhook is empty', async () => {
    const { createDeployment, getDeployment, getDeploymentProgress, notify } = await setupIndexRun({
      WEBHOOK_URL: ''
    });

    const deploymentResponse = {
      code: 'dep-3',
      status: DeploymentStatus.DEPLOYING,
      buildCode: 'build-3',
      environmentCode: 'env-3',
      databaseUpdateMode: DataMigrationMode.UPDATE,
      strategy: DeploymentMode.ROLLING_UPDATE,
      subscriptionCode: 'sub-3',
      createdTimestamp: new Date('2024-01-01T00:00:00.000Z')
    } as unknown as DeploymentResponse;

    createDeployment.mockResolvedValue(deploymentResponse);
    getDeployment.mockResolvedValue(deploymentResponse);
    getDeploymentProgress.mockResolvedValue({
      deploymentStatus: DeploymentStatus.DEPLOYED,
      percentage: 100
    } as unknown as DeploymentProgress);

    await import('../src/index');

    await flushImmediate();

    expect(notify).not.toHaveBeenCalled();
  });
});
