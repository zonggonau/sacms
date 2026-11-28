# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### MCP hardening
- **Global `deploy_to_sacms`**: deploys a built Website Template straight to SaCMS Cloud Hosting through its demo deployment. It is the same deploy as `redeploy_website_template_demo`, under the name the workspace server uses, so agents find it on both servers. Production is still released from Infrastructure → Hosting.
- **Dashboard workspace list**: each workspace is labelled Produksi or Demo, and tabs filter the list between Semua, Produksi, and Demo. The filter runs on the server, so pagination and counts follow it.
- **Global MCP `delete` scope**: deleting a Website Template, Schema Template or Global Component needs the `delete` scope. The `write` scope can no longer delete catalog data. Existing tokens keep `write` only, so re-issue a token that needs deletes.
- **Workspace `get_or_create_api_key` and `call_external_api` need the `env` scope** (was `write`). Both handle secrets. `call_external_api` now sends requests over HTTPS only.
- **Tool annotations**: every preview tool and the global operation-status tool declare read-only or write hints, so clients can tell them apart. `stop_preview` is marked destructive.
- **`sync_dev_env`** (both servers) is marked sensitive in its description, because it returns a live API key.
- **Removed** the compatibility aliases `start_site_preview` and `get_site_preview`. Use `start_preview` and `get_preview_url`, which accept the same `siteId`.

### Added
- **SaCMS Next.js starter as the locked base for agent-built sites**: the official repository `zonggonau/sacms-nextjs-starter` (default branch, current commit) is fetched from GitHub. Workspace MCP: `download_starter_template` installs its default schema, `.env.example` variables, and source as the workspace's first revision. Global MCP: `get_starter_template` reads it, and `create_website_template` with `starter: true` builds a template on it. The starter's files are locked: deploy, rollback, and preview edits that change or remove one return `STARTER_LOCKED`, while new files are allowed. `package-lock.json` is left out of the snapshot (224 KB, over the 200 KB text-file cap, and npm regenerates it).
- **Starter lock** (`src/lib/infrastructure/starter-template.ts`): per-scope hashes stored in `Setting` (`starter-lock:workspace:<tenantId>`, `starter-lock:template:<templateId>`). Applying a catalog Website Template to a workspace replaces its starter lock.
- **Starter Next.js untuk SaCMS** (`examples/nextjs-starter`) dibuat ulang: Next.js 16.4.6, `@sacms/sdk` 1.2.1, komponen shadcn/ui, helper data yang membedakan ok / kosong / error, komponen richText (sanitized), markdown, dan media, serta webhook revalidasi dengan verifikasi HMAC. Diuji terhadap server SaCMS tiruan dan dengan env kosong.
- **Langkah berikutnya**: a card on the workspace dashboard and a read-only `get_next_step` MCP tool (workspace MCP 4.12.0) show where the workspace is on the path from planning to a live site (plan schema, add content, deploy frontend, live) and the next tools or pages for that stage. Both use one derivation, `src/lib/workspace-next-step.ts`.
- **OAuth 2.1 for the workspace MCP server** (`/api/mcp`): ChatGPT, Grok, and Claude.ai can connect by Server URL alone. The client opens a SaCMS consent page, and the owner or admin picks the workspace. Discovery (RFC 9728, RFC 8414), dynamic client registration (RFC 7591), PKCE S256, single-use codes, and rotating refresh tokens. Access tokens are one-hour `mcp` tokens. Details in `docs/mcp/oauth.md`. Not yet verified against the live ChatGPT, Grok, and Claude.ai clients.
- **Per-workspace MCP URL** `/api/mcp/w/<slug>`: the dashboard shows this as the Server URL. OAuth consent is locked to that workspace (no picker), and a token from another workspace gets `403`. The shared `/api/mcp` still works for existing connections.
- **Rotate a workspace MCP token** from `/developer/mcp` ("Putar"). The old token and any OAuth connection that used it are revoked.

### Changed
- **Workspace MCP 4.11.0 contract fixes**: `verify_deployment_url` now checks the same deployment `get_deployment_status` reports (the project's latest production deployment), so a READY build is not reported as "no deployment". READY only means the build finished; a release is confirmed by the HTTP checks. `list_website_versions` labels each row `kind: deployed` or `kind: draft`, and the docs name the one revision id each tool accepts. `get_deployment_source` reports `imported` when it creates a snapshot.
- **Narrower access for integrations**: `sync_dev_env` needs its own `env` scope (it returns SACMS_API_KEY and every custom secret), not just `write`. Workspace tokens issued from now on include `env`; existing tokens and OAuth connections need to be reissued to use `sync_dev_env`. `call_external_api` refuses a request that would send a secret to a host outside the workspace's allowlist (Setting `<tenantId>_secretHostAllowlist`) when one is set. The playbook tells agents to read `site-settings` slugs from the workspace schema and to use a server route, not a browser key, for writes.
- **Sample content covers Single Types, and can be listed, verified, and cleared** (workspace MCP 4.10.0 and Global demo): `list_sample_batches`, `verify_sample_batch`, `clear_sample_batch` (workspace) and `list_demo_sample_batches`, `verify_demo_sample_batch`, `clear_demo_sample_batch` (Global demo). Verify reads each recorded entry back and checks its locale and, when PUBLISHED, that the public API returns it. Clear soft-deletes only the recorded entries and empties the Single Type content the batch wrote; it needs `confirm: true` and a second call does nothing. Single Types that already have content in the locale are left alone.
- **Deploy checks the site's use of content** (advisory, never blocks the deploy): a slug the code fetches that the schema lacks, a content request with no locale, a fetch whose HTTP status is never checked, and a site that reads content with no revalidation hook. The warnings come back in the `warnings` field of `deploy_to_sacms`, `deploy_website_patch`, and the dashboard deploy.
- **Sample content tools** (workspace MCP 4.9.0 and Global MCP): `plan_sample_content` and `seed_sample_content` for a workspace, and `plan_demo_sample_content` and `seed_demo_sample_content` for a Schema Template's demo workspace. The plan reads the schema, orders relation targets first, and reports what it cannot fill (media, Member relations). Seeding writes entries through the normal create path, skips Content Types that already have data, and records the created ids per batch, so a re-run does not duplicate and the data can be cleaned up. Workspace seeds default to DRAFT; demo seeds default to PUBLISHED.
- **Reset Schema replaces Publish Schema** on `/developer/schema`: one button deletes every Content Type, Single Type, and Component this workspace owns, after a confirmation. The delete-schema route now blocks the SaCMS Global workspace on the server, as its comment always said. A workspace that is already Final still gets "Kembalikan ke Draft".
- **AI Schema Generator reuses the SaCMS Global schema**: before generating, the generator reads Global's default Components and Single Types and lists them in the prompt. Anything the new schema references that it does not define is copied in from Global, so a shared definition (e.g. `nav-link`, Site Settings) is reused, not duplicated.
- **Navigation and social links are components**: the AI Schema Generator's Site Settings uses a repeatable `nav-link` (label + URL) and `social-link` component instead of `tags`, which could not hold a label and a URL together. Both components are created with the Site Settings.
- **AI schema review shows each field's type**: every field card shows its type name, its relation target or component, the number of select choices, and a ⚠ on anything that would block the save. The save error lists the first problems.
- **Schema save checks references**: saving an AI-generated schema now runs the same checks as the MCP and template paths. A relation or component pointing at nothing, or a select with no choices, blocks the save with a list of what to fix. Models already in the workspace count as valid targets. A component's `componentSlug` is no longer dropped when the field also has options.
- **AI Schema Generator knows field options**: the model can now set `select`/`multiselect` choices, relation `relationType` and `targetModel`, repeatable components, and repeater `allowedComponents`. Its prompt uses the audited field guide. Authors, team, and staff are Content Types, not Members. `location` holds lat/lng only, and currency is always IDR.
- **Website Template pricing**: Standar, Pro, and Bisnis workspaces buy each priced template once (lifetime). Enterprise workspaces get unpriced templates free; a priced template is a one-time, lifetime purchase that Enterprise buys too. Applies to the dashboard gallery, the purchase route, and the MCP apply tool.
- **MCP workspace release path**: website changes are built and released through one path only: `start_preview` → `apply_preview_changes` → `save_preview_changes`, then an administrator releases from Infrastructure → Hosting. `deploy_to_sacms` is now documented as a one-shot staging build, not the normal release path. The playbook, `instructions`, and tool descriptions all say the same thing (workspace MCP 4.8.0).
- **MCP guidance in one place**: the workspace `instructions` and playbook moved to `src/lib/mcp/workspace-guidance.ts`, and the global `instructions` moved to `src/lib/mcp/global-guidance.ts`. Their version numbers are set there too (global MCP 1.21.0).
- **MCP documentation**: `docs/mcp/` covers both servers, the release path, auth and token scopes, and maintenance. `docs/mcp/tool-manifest.json` lists every tool and is checked by a test.
- **MCP route split**: the tool bodies moved out of the two route files into per-domain modules (`src/lib/mcp/workspace/*-tools.ts`, `src/lib/mcp/global/*-tools.ts`) with shared helpers in each `context.ts`. The routes now only build the server and register those modules. Tool names, schemas, and behavior are unchanged.

### Removed
- **`get_operation_status` on the global MCP server** (the deprecated alias) is removed. Use `get_global_operation_status`, which is read-only and has the same behavior. The workspace server's `get_operation_status` is unchanged.
- **Bring-Your-Own-VPS Hosting**: Removed the customer-facing VPS/VDS provisioning feature end-to-end — the Contabo provisioning integration (`lib/contabo.ts`), VPS catalog/ordering actions (`actions/vps-service.ts`), the "Cloud Server" catalog page, the per-workspace VPS lifecycle UI, the `UserVpsService` model and table, every `vps-*`/`vds-*` pricing slug across billing/checkout/plan-enforcement, and the now-unused `ssh2` dependency. Every workspace now uses SaCMS's own managed infrastructure (`ManagedInfraService`/BYODB for a dedicated database, and `StorageAddon` for storage upgrades) instead.
- **In-Dashboard AI Website Builder**: Removed the single-file AI website generator (Developer Portal > AI Instant Website), its `TenantStaticSite` model/table, the `/api/tenant/[tenant]/static-site/*` routes, the public `/site/[tenant]` serving route, the `write_static_site` MCP tool, and the "site" custom-domain target. Frontend development now happens in an IDE, connected to SaCMS via MCP (`deploy_to_vercel` and the other developer-facing MCP tools).
- **Content locales (`id`, `en`, and any other per-entry language)** are removed. An entry is now one record, and a Single Type has one assignment per workspace. Public API responses no longer include `locale` or `availableLocales`, and `?locale=` is ignored. Breaking for MCP clients and API consumers that send `locale`: workspace MCP 5.0.0 and Global MCP 2.0.0 drop the parameter.
- **AI translation** (`/api/tenant/*/ai/translate`, the translate action in the AI assistant, and the translate tab in the CMS AI modal) is removed with the locale feature.
- **Workspace locale limit** (`maxLocales`) is removed from plans, custom overrides, pricing, and the pricing catalog.
- **Workspace backup format 1.2** no longer includes `locales`. Backups in format 1.0 and 1.1 still import; their `locales` section is ignored.

### Migration
- Before deploying, delete any content in non-default locales (and the `id` content if you keep `en`). The schema change drops the `locale` column and the `tenant_locales` table; `prisma db push` refuses to drop a column that still holds data.


## [1.3.0] - 2026-08-24

### Added
- **Dedicated Multi-Tenant Infrastructure & BYODB**: Automated Zero-Touch provisioning for Cloud VPS & VDS instances with PostgreSQL 17, MinIO S3 object storage, and automated Cloudflare DNS subdomains (`src/lib/infrastructure/`).
- **Dynamic 10-Tier Pricing Catalog**: Full segmentation across Cloud Ekonomis (4 tiers), Business VPS (3 tiers), and Gov & Enterprise VDS (3 tiers) powered 100% dynamically from Global CMS without hardcoding (`src/app/api/tenant/[tenant]/subscriptions/plans/route.ts`).
- **Dual-Language i18n System (ID & EN)**: Complete bilingual dictionary and reactive `LanguageSwitcher` pill with `localStorage`/cookie persistence across the entire public frontend (`src/lib/i18n/`, `src/components/ui/language-switcher.tsx`).
- **Infrastructure Health & Troubleshooting Hub**: Live 30-second monitoring dashboard with interactive remediation tools (Live Ping, DB query test, Schema Sync, DNS Sync, VPS Reboot, and Credential decryption) in `src/app/(system)/admin/infrastructure/page.tsx`.

### Changed
- **Direct Yearly Billing**: Locked subscription intervals to yearly billing with automated 2-month discount formulas and Midtrans Snap integration.
- **SaCMS Brand Unification**: Consolidated vendor identity to SaCMS brand across all public landing sections and tenant dashboards.

## [1.2.1.0] - 2026-08-23

### Added
- **AI Schema Engine & Domain Blueprints**: Intelligent schema design engine with rich domain presets (Hotel, E-Commerce, News, Agency) in `src/lib/ai/schema-engine.ts` and `src/lib/ai/domain-knowledge.ts`.
- **MCP (Model Context Protocol) Toolkit**: Full MCP server endpoints for Cursor, Claude Code, and Windsurf AI assistant integrations (`src/app/api/mcp/[[...transport]]/route.ts`).
- **Next.js 16 Starter Project Export**: Instant ZIP starter export API for quick client scaffolding (`src/app/api/tenant/[tenant]/ai-builder/export-starter/route.ts`).
- **Agency Accelerator Strategy**: Complete agency wedge product blueprint and automated review evidence in `docs/designs/sacms-agency-wedge.md`.

### Fixed & Hardened
- **TypeScript Type Integrity**: Resolved 18 compile errors across Prisma models, Zod dynamic validators, and Next.js 16 binary response signatures (`tsc --noEmit` exits 0).
- **Unit Test Suite 100% Pass**: Resolved mock desynchronization in `__tests__/api/public-content.test.ts` (112/112 unit tests across 18 test files passing).
- **Dedicated Enterprise DB Fallback**: Added try/catch and automatic fallback to master database in `src/lib/database.ts:getTenantDb` to prevent cluster downtime crashes.
- **Zod v4 Compatibility**: Upgraded dynamic content validator and schema engine error messaging to Zod v4 syntax.
- **Role Permissions Compound Key**: Corrected Prisma unique compound identifiers in `src/actions/roles.ts` and role management API routes.

### Changed
- Refined Dashboard, Content Entries Manager, Single Type Editor, and Developer MCP UI components with modern Radix UI styling.
