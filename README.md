# SAP Commerce Cloud - Deploy

This GitHub Action provides the following functionalities to perform deployment operations on SAP Commerce Cloud in the
Public Cloud (CCv2) projects.

### 🚀 Completed Items

- [x] **Trigger Deployment**: Trigger SAP Commerce Cloud deployment.

### 🔧 Planned Items

- [ ] **Deployment Notification**: Sends a notification when a deployment is triggered in CCv2.
- [ ] **Deployment Status Notification**: Frequently check the deployment status and send notifications when success or failure.
- [ ] **Testing**: Improve test coverage with end-to-end tests.
- [ ] **Notifications**: Notify the user via email or webhook when the build is triggered or completed.
    - [ ] Create Build: Triggered with deployment is created in CCv2.
    - [ ] Build Progress: Check the deployment status and send notifications. (Is it required?)
    - [ ] Build Completed: Triggered when the deployment is completed in CCv2 whether it is success or failure.
    - [ ] Slack: Send notifications to Slack.
    - [ ] Email: Send notifications to email.
        - [ ] SendGrid: Send notifications using SendGrid.
        - [ ] AWS SES: Send notifications using AWS SES.
        - [ ] Custom SMTP: Send notifications using custom SMTP.
        - [ ] Similar SMTP services.
    - [ ] Microsoft Teams: Send notifications to Microsoft Teams.

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
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Trigger SAP Commerce Cloud Deployment
        uses: sap-cx-actions/commerce-deploy@v1
        with:
          token: ${{ secrets.CCV2_API_TOKEN }}
          subscriptionCode: ${{ secrets.CCV2_SUBSCRIPTION_CODE }}
          buildCode: '20240910.1'
          environmentCode: 'd1'
          databaseUpdateMode: 'UPDATE'
          deploymentMode: 'ROLLING_UPDATE'          
          notify: true
          destination: ${{ secrets.WEBHOOK_URL }}
```

### Inputs

- `token` - **Required**. SAP Commerce Cloud in the Public Cloud (CCv2) API Token.
- `subscriptionCode` - **Required**. SAP Commerce Cloud in the Public Cloud (CCv2) Subscription Code.
- `buildCode` - **Required**. The build code to deploy.
- `environmentCode` - **Required**. The environment code to deploy. Example: `d1`, `s1`, `p1`.
- `databaseUpdateMode` - **Required**. The database update mode. Example: `NONE`, `UPDATE`, `INITIALIZE`.
- `deploymentMode` - **Required**. The deployment strategy. Example: `ROLLING_UPDATE`, `RECREATE`, `GREEN`.
- `notify` - **Optional**. Send notifications to the provided destination.
- `destination` - **Optional**. The destination to send notifications.
- 
### Outputs

- `deploymentCode` - The deployment code of the current deployment.
- `deploymentStatus` - The status of the triggered deployment.
