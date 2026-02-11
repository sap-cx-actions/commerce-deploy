import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import dayjs from 'dayjs';
import { SAP } from '@sap-cx-actions/commerce-services/src/constants';
import { DeploymentResponse, NotificationType } from '@sap-cx-actions/models';

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
  INPUT_DATABASEUPDATEMODE: 'UPDATE',
  INPUT_DEPLOYMENTMODE: 'ROLLING',
  INPUT_CHECKSTATUSINTERVAL: '1500',
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

const loadUtils = async (envOverrides: Record<string, string | undefined> = {}) => {
  jest.resetModules();
  setEnv(envOverrides);
  await createSummaryFile();
  return await import('../src/utils');
};

afterEach(async () => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await fs.rm(path.dirname(summaryPath), { recursive: true, force: true });
  }
  for (const key of envKeys) {
    delete process.env[key];
  }
  envKeys.clear();
});

describe('utils', () => {
  it('builds getInputs from core inputs and env', async () => {
    const utils = await loadUtils({
      INPUT_CHECKSTATUSINTERVAL: '2500',
      INPUT_NOTIFY: 'false',
      INPUT_DRYRUN: 'true'
    });

    expect(utils.getInputs).toEqual({
      token: 'token-1',
      subscriptionCode: 'sub-1',
      tokenEndpoint: 'https://tokens.example.test',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      resource: 'resource-1',
      buildCode: 'build-1',
      environmentCode: 'env-1',
      databaseUpdateMode: 'UPDATE',
      deploymentMode: 'ROLLING',
      checkStatusInterval: 2500,
      retryOnFailure: false,
      maxRetries: 3,
      notify: false,
      webhookUrl: 'https://hooks.example.test',
      dryRun: true,
      timezone: 'UTC'
    });
  });

  it('falls back to empty strings for missing env inputs', async () => {
    const utils = await loadUtils({
      SAP_CCV2_API_TOKEN: undefined,
      SAP_CCV2_SUB_CODE: undefined,
      SAP_CCV2_TOKEN_ENDPOINT: undefined,
      SAP_CCV2_CLIENT_ID: undefined,
      SAP_CCV2_CLIENT_SECRET: undefined,
      SAP_CCV2_RESOURCE: undefined
    });

    expect(utils.getInputs).toEqual(
      expect.objectContaining({
        token: '',
        subscriptionCode: '',
        tokenEndpoint: '',
        clientId: '',
        clientSecret: '',
        resource: ''
      })
    );
  });

  it('returns workflow run url with default server url', async () => {
    const utils = await loadUtils({
      GITHUB_REPOSITORY: 'acme/proj',
      GITHUB_RUN_ID: '99',
      GITHUB_SERVER_URL: undefined
    });

    expect(utils.getWorkflowRunUrl()).toBe('https://github.com/acme/proj/actions/runs/99');
  });

  it('builds a notification with workflow url and timezone', async () => {
    const utils = await loadUtils({
      GITHUB_REPOSITORY: 'org/repo',
      GITHUB_RUN_ID: '7',
      GITHUB_SERVER_URL: 'https://github.example.test',
      INPUT_TIMEZONE: 'America/Los_Angeles'
    });

    const notification = utils.buildNotification(NotificationType.DEPLOYMENT_STARTED, { id: 123 });

    expect(notification).toEqual({
      type: NotificationType.DEPLOYMENT_STARTED,
      content: { id: 123 },
      info: {
        timezone: 'America/Los_Angeles',
        workflowRunUrl: 'https://github.example.test/org/repo/actions/runs/7'
      }
    });
  });

  it('adds a deployment summary to core summary', async () => {
    const utils = await loadUtils();

    const deploymentResponse = {
      code: 'dep-1',
      buildCode: 'build-1',
      environmentCode: 'env-1',
      databaseUpdateMode: 'UPDATE',
      strategy: 'ROLLING',
      createdTimestamp: '2024-01-01T00:00:00.000Z',
      subscriptionCode: 'sub-1'
    } as unknown as DeploymentResponse;

    await utils.addSummary(deploymentResponse);

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new Error('GITHUB_STEP_SUMMARY not set');
    }
    const summaryContent = await fs.readFile(summaryPath, 'utf8');

    expect(summaryContent).toContain('SAP Commerce Cloud - Deployment Summary');
    expect(summaryContent).toContain('Deployment Code');
    expect(summaryContent).toContain('Build Code');
    expect(summaryContent).toContain('Environment Code');
    expect(summaryContent).toContain('Data Migration Mode');
    expect(summaryContent).toContain('Deployment Strategy');
    expect(summaryContent).toContain('Started');
    expect(summaryContent).toContain('dep-1');
    expect(summaryContent).toContain('build-1');
    expect(summaryContent).toContain('env-1');
    expect(summaryContent).toContain('UPDATE');
    expect(summaryContent).toContain('ROLLING');
    expect(summaryContent).toContain(dayjs('2024-01-01T00:00:00.000Z').format(SAP.CX.Actions.DATE_FORMAT));
    expect(summaryContent).toContain(
      `${SAP.CX.Actions.CLOUD_PORTAL_API_URL}/subscription/sub-1/applications/commerce-cloud/environments/env-1/deployments/dep-1`
    );
  });
});
