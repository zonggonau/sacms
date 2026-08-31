---
name: hosting-deployment
description: Deploy frontend websites to Vercel Serverless and provision dedicated Contabo VPS appliances via SaCMS MCP.
---

# Hosting & Cloud Deployment Skill for SaCMS

Use this skill when the user asks to deploy their frontend application to production or inspect their dedicated VPS infrastructure.

## 🛠️ Relevant MCP Tools:
- `deploy_to_vercel`: Deploy static or Next.js frontend source files directly to Vercel Serverless.
- `get_vercel_deployment_status`: Check live build progress and URL.
- `configure_vercel_domain`: Attach custom domain to Vercel project with DNS diagnostics.
- `get_contabo_infrastructure_status`: Inspect CPU, RAM, Disk, IP address, and PostgreSQL/MinIO status on Contabo VPS.
- `provision_contabo_vps`: Trigger automated provisioning of dedicated VPS for paid workspaces.

## ⚡ Deployment Workflows:

### 1. Deploying to Vercel:
```json
{
  "projectName": "my-headless-frontend",
  "files": [
    { "name": "index.html", "content": "<!DOCTYPE html><html>...</html>" },
    { "name": "package.json", "content": "..." }
  ],
  "envVars": {
    "NEXT_PUBLIC_SACMS_URL": "https://sacms.cloud"
  }
}
```

### 2. Dedicated Contabo VPS Appliance:
Workspaces on `vps-s`, `vps-m`, `vps-l`, or `enterprise` plans with status `PAID` can call `get_contabo_infrastructure_status` to view dedicated server metrics, isolated PostgreSQL 17 endpoints, and MinIO storage buckets.
