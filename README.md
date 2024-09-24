# SAP Commerce Cloud - Deploy

This GitHub Action provides the following functionalities to perform deployment operations on SAP Commerce Cloud in the
Public Cloud (CCv2) projects.

### 🚀 Completed Items

- [x] **Trigger Deployment**: Trigger SAP Commerce Cloud deployment.
- [x] **Deployment Notification**: Sends a notification when a deployment is triggered in CCv2.
- [x] **Deployment Status Notification**: Frequently check the deployment status and send notifications when success or
      failure.
- [x] **Notifications**: Notify the user via email or webhook when the build is triggered or completed.
  - [x] Trigger Deployment: Triggered with deployment is created in CCv2.
  - [x] Deployment Completed: Triggered when the deployment is completed in CCv2 whether it is success or failure.
  - [x] Slack: Send notifications to Slack.
  - [x] Microsoft Teams: Send notifications to Microsoft Teams.

### 🔧 Planned Items

- [ ] **Testing**: Improve test coverage with end-to-end tests.
- [ ] **Notifications**: Notify the user via email or webhook when the build is triggered or completed.
  - [ ] Deployment Progress: Check the deployment status and send notifications. (Is it required?)
  - [ ] Email: Send notifications to email.
    - [ ] SendGrid: Send notifications using SendGrid.
    - [ ] AWS SES: Send notifications using AWS SES.
    - [ ] Custom SMTP: Send notifications using custom SMTP.
    - [ ] Similar SMTP services.

## Getting Started

See [action.yml](action.yml)

### Prerequisites

- GitHub repository with SAP Commerce Cloud in the Public Cloud (CCv2) project.
- SAP Commerce Cloud in the Public Cloud (CCv2) project with the required configurations.
- Webhook URL or email address(es) to send notifications.
- GitHub Actions enabled in the repository.
- GitHub token with the required permissions.
- SAP Commerce Cloud in the Public Cloud (CCv2) API Token.
- SAP Commerce Cloud in the Public Cloud (CCv2) Subscription Code.
- Build code to deploy.
- Environment code to deploy.
- Platform update mode.
- Deployment strategy.

### Example Workflow

Create a workflow YAML file (e.g., .github/workflows/deploy.yml) in your repository with the following content:

```yaml
name: Deploy SAP Commerce Cloud

on:
  push:
    branches:
      - main
      - 'release/*'
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    env:
      SAP_CCV2_API_TOKEN: ${{ secrets.SAP_CCV2_API_TOKEN }}
      SAP_CCV2_SUB_CODE: ${{ secrets.SAP_CCV2_SUB_CODE }}
      WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Trigger SAP Commerce Cloud Deployment
        id: deploy-action
        uses: sap-cx-actions/commerce-deploy@v1
        with:
          buildCode: '20240910.1'
          environmentCode: 'd1'
          databaseUpdateMode: 'UPDATE'
          deploymentMode: 'ROLLING_UPDATE'
          notify: true
          dryRun: false

      - name: Print Output
        id: output
        run: |
          echo "Deployment Code: ${{ steps.deploy-action.outputs.deploymentCode }}, Deployment Status: ${{ steps.deploy-action.outputs.deploymentStatus }}"
```

### Environment Variables

| Variable           | Purpose                                                                                                                                                                                                   | Required |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SAP_CCV2_API_TOKEN | SAP Commerce Cloud in the Public Cloud (CCv2) [API Token](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/0fa6bcf4736c46f78c248512391eb467/65e64c9602534b8aaf25bb119670614f.html?locale=en-US). | True     |
| SAP_CCV2_SUB_CODE  | SAP Commerce Cloud in the Public Cloud (CCv2) Subscription Code                                                                                                                                           | True     |
| WEBHOOK_URL        | The Webhook URL to send notifications.                                                                                                                                                                    | False    |

### Inputs

| Attribute          | Purpose                                                                                                                       | Required | Default | Example                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------- |
| buildCode          | The build code to deploy, output from the [@sap-cx-actions/commerce-build](https://github.com/sap-cx-actions/commerce-build). | True     |         |                                       |
| environmentCode    | The environment code to deploy.                                                                                               | True     |         | `d1`, `s1`, `p1`                      |
| databaseUpdateMode | The database update mode.                                                                                                     | True     |         | `NONE`, `UPDATE`, `INITIALIZE`        |
| deploymentMode     | The deployment strategy.                                                                                                      | True     |         | `ROLLING_UPDATE`, `RECREATE`, `GREEN` |
| notify             | Send notifications to the provided destination.                                                                               | False    | `false` | `true`, `false`                       |
| dryRun             | Run the action in dry-run mode. If true, the action will not trigger the deployment in actual CCv2.                           | False    | `false` | `false`                               |

### Outputs

- `deploymentCode` - The deployment code of the current deployment.
- `deploymentStatus` - The status of the triggered deployment.
