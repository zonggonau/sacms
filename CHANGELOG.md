# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **MCP workspace release path**: website changes are built and released through one path only: `start_preview` → `apply_preview_changes` → `save_preview_changes`, then an administrator releases from Infrastructure → Hosting. `deploy_to_sacms` is now documented as a one-shot staging build, not the normal release path. The playbook, `instructions`, and tool descriptions all say the same thing (workspace MCP 4.8.0).
- **MCP guidance in one place**: the workspace `instructions` and playbook moved to `src/lib/mcp/workspace-guidance.ts`, and the global `instructions` moved to `src/lib/mcp/global-guidance.ts`. Their version numbers are set there too (global MCP 1.21.0).
- **MCP documentation**: `docs/mcp/` covers both servers, the release path, auth and token scopes, and maintenance. `docs/mcp/tool-manifest.json` lists every tool and is checked by a test.

### Deprecated
- **`get_operation_status` on the global MCP server**: renamed to `get_global_operation_status`. The old name still works as an alias and will be removed in the next major release. The workspace server's `get_operation_status` is unchanged.

### Removed
- **Bring-Your-Own-VPS Hosting**: Removed the customer-facing VPS/VDS provisioning feature end-to-end — the Contabo provisioning integration (`lib/contabo.ts`), VPS catalog/ordering actions (`actions/vps-service.ts`), the "Cloud Server" catalog page, the per-workspace VPS lifecycle UI, the `UserVpsService` model and table, every `vps-*`/`vds-*` pricing slug across billing/checkout/plan-enforcement, and the now-unused `ssh2` dependency. Every workspace now uses SaCMS's own managed infrastructure (`ManagedInfraService`/BYODB for a dedicated database, and `StorageAddon` for storage upgrades) instead.
- **In-Dashboard AI Website Builder**: Removed the single-file AI website generator (Developer Portal > AI Instant Website), its `TenantStaticSite` model/table, the `/api/tenant/[tenant]/static-site/*` routes, the public `/site/[tenant]` serving route, the `write_static_site` MCP tool, and the "site" custom-domain target. Frontend development now happens in an IDE, connected to SaCMS via MCP (`deploy_to_vercel` and the other developer-facing MCP tools).

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
