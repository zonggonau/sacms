# SaCMS Official Plugin for ChatGPT & Codex

The official OpenAI Plugin and Model Context Protocol (MCP) bundle for **SaCMS** (Headless SaaS CMS).

---

## 🚀 Installation Guide

### Option 1: 1-Click Install in Codex & ChatGPT Desktop
Add the plugin marketplace directly from the command line:
```bash
codex plugin marketplace add zonggonau/sacms
```
Then open ChatGPT Desktop / Codex $\rightarrow$ **Plugins Directory** $\rightarrow$ Click **Install** on **SaCMS**.

### Option 2: ChatGPT Developer Mode (MCP Server)
1. Open [ChatGPT](https://chatgpt.com) $\rightarrow$ **Settings** $\rightarrow$ **Security and login** $\rightarrow$ Enable **Developer mode**.
2. Navigate to [ChatGPT Plugins](https://chatgpt.com/plugins) $\rightarrow$ Click **`+` (Add Plugin)**.
3. Enter MCP Server URL:
   ```
   https://sacms.cloud/api/mcp
   ```
4. Header:
   ```
   Authorization: Bearer <YOUR_SACMS_API_TOKEN>
   ```

### Option 3: ChatGPT Custom GPT (Action via OpenAPI)
1. In ChatGPT GPT Builder $\rightarrow$ **Actions** $\rightarrow$ **Import from URL**:
   ```
   https://sacms.cloud/api/public/<your-tenant-slug>/openapi.json
   ```
2. Authentication: Select **API Key** $\rightarrow$ Auth Type: **Bearer** $\rightarrow$ Paste your API Token.

---

## 🛠️ Complete MCP Tools Catalog (31 Tools)

| Category | Tools | Description |
| :--- | :--- | :--- |
| **Schema** | `get_full_schema`, `list_field_types`, `list_content_types`, `get_content_type`, `create_content_type`, `update_content_type`, `delete_content_type` | Database architecture and 33 field type definitions. |
| **Content** | `list_entries`, `get_entry`, `create_entry`, `update_entry`, `delete_entry`, `bulk_create_entries`, `bulk_delete_entries` | Full CRUD, Strapi-style filtering, localization, pagination. |
| **Single Types** | `get_single_type`, `update_single_type`, `create_single_type`, `list_components`, `create_component` | Singleton pages and reusable component blocks. |
| **Webhooks** | `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook`, `test_webhook` | Event triggers and automated rebuild pipelines. |
| **Hosting** | `deploy_to_vercel`, `get_vercel_deployment_status`, `configure_vercel_domain`, `get_contabo_infrastructure_status`, `provision_contabo_vps` | Vercel deployment and dedicated Contabo VPS management. |
| **API** | `inspect_api_capabilities`, `get_api_info` | Gateway inspection and documentation endpoints. |
