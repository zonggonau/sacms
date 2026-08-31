---
name: webhooks-automation
description: Configure webhooks and event triggers for content publishing and third-party integrations.
---

# Webhooks & Automation Skill for SaCMS

Use this skill when the user wants to set up automated build triggers (e.g. Vercel build hooks, GitHub repository dispatch, Discord/Slack notifications).

## 🛠️ Relevant MCP Tools:
- `list_webhooks`: View all active webhook subscriptions in the workspace.
- `create_webhook`: Register a new webhook endpoint with event triggers (`entry.create`, `entry.update`, `entry.publish`, `entry.delete`).
- `update_webhook`: Modify URL, headers, or event filters.
- `delete_webhook`: Remove a webhook.
- `test_webhook`: Send a mock test ping payload to verify target server connectivity.
