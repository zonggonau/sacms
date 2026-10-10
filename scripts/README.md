# SaCMS Script Architecture & Directory Structure

This directory houses all operational, database management, testing, migration, and seeding scripts for SaCMS.

---

## 📁 Directory Layout

```
scripts/
├── cli.ts               # Unified interactive & command-line runner (`bun scripts/cli.ts <cmd>`)
├── core/                # Production & operational tasks (cron workers, healthchecks, asset bundler)
│   ├── scheduled-publish.ts     # Scheduled content publishing worker
│   ├── copy-standalone-assets.js# Asset copier for standalone Next.js docker builds
│   ├── healthcheck.js           # Lightweight Docker container health check
│   ├── update-api-key.ts        # Secure platform systemApiKey generator / rotator
│   └── cron-jobs.md             # Automated billing & cron jobs documentation
│
├── seed/                # Database seeding & initial state configuration
│   ├── seed-all-global.ts       # Master seeder for platform models, components & landing data
│   ├── seed-permissions.ts      # Global RBAC permissions & default role matrix
│   ├── seed-plans.ts            # Workspace, account & add-on subscription tiers
│   ├── setup-sacms.ts           # Canonical initial platform content models
│   ├── setup-system-settings.ts # Default system settings
│   ├── setup-templates.ts       # Pre-built website templates (blog, ecommerce, company)
│   └── clear-global.ts          # Wipes sacms-global data for clean re-seeding
│
├── migrate/             # Database migrations, dedicated DB sync, and schema backfills
│   ├── push-tenant-schema.ts    # Pushes Prisma schema to dedicated tenant database
│   ├── migrate-local-media.ts   # Migrates local /upload/ assets to MinIO / Cloudflare R2
│   ├── migrate-domains.ts       # Migrates legacy domains to CustomDomain table
│   ├── setup-fts.ts             # Installs PostgreSQL Full-Text Search trigger and GIN index
│   ├── backfill-document-id.ts  # Backfills documentId for multi-locale entries
│   ├── backfill-owner-slugs.ts  # Backfills owner slugs and associates workspace owners
│   └── backfill-apikey-hash.ts  # Re-hashes legacy plaintext ApiKey.key values to SHA-256
│
├── qa/                  # Automated quality assurance, audit & SDK generators
│   ├── qa-runner.ts             # Route-by-route audit and latency benchmark
│   ├── qa-security-smoke.ts     # Security smoke tests (SSRF, auth gates, path traversal)
│   └── generate-sdk-types.ts    # Generates TypeScript SDK definitions from database schema
│
├── shell/               # DevOps & server maintenance shell scripts
│   ├── db-backup.sh             # PostgreSQL pg_dump backup with automated 7-day rotation
│   ├── db-restore.sh            # PostgreSQL restore from custom dump
│   ├── deploy-manual.sh         # Manual rsync / SSH deployment script
│   ├── vps-dev-deploy.sh        # Remote VPS git pull, build & restart automation
│   └── vps-setup.sh             # Initial VPS provisioning script (Docker, Caddy, Bun)
│
├── archive/             # Historical, ad-hoc, and one-off maintenance scripts
│   ├── checks/                  # Historical inspection scripts (check-*, list-*, inspect-*)
│   ├── fixes/                   # Historical patch scripts (fix-*, add-*, assign-*, update-*)
│   ├── debug/                   # Ad-hoc debugging scripts (debug-*, test-*)
│   └── dev/                     # Rapid development scratch tests
│
└── [compatibility entrypoints at root]
    ├── healthcheck.js           # Proxies to core/healthcheck.js (used in docker-compose.yml)
    ├── copy-standalone-assets.js# Proxies to core/copy-standalone-assets.js (used in `bun run build`)
    ├── push-tenant-schema.ts    # Proxies to migrate/push-tenant-schema.ts (used in `bun run db:tenant:push`)
    ├── scheduled-publish.ts     # Proxies to core/scheduled-publish.ts (used in `bun run cron:publish`)
    ├── seed-permissions.ts      # Proxies to seed/seed-permissions.ts (used in `bun run seed:permissions`)
    ├── seed-all-global.ts       # Proxies to seed/seed-all-global.ts (used in `bun run seed:global` & API)
    ├── qa-runner.ts             # Proxies to qa/qa-runner.ts (used in `bun run qa`)
    └── migrate-local-media.ts   # Re-exports migrate/migrate-local-media.ts (used in vitest)
```

---

## 🚀 Unified CLI Runner

You can execute any script through the central CLI runner:

```bash
# View all available commands
bun scripts/cli.ts help

# Seeding
bun run cli seed:global
bun run cli seed:permissions
bun run cli seed:workflow         # Doc 14 Content Workflow Permissions
bun run cli seed:plans

# Migrations & Tenant DB
bun run cli migrate:tenant <tenantSlugOrId>
bun run cli migrate:media --apply
bun run cli migrate:fts

# QA & Security
bun run cli qa:audit http://localhost:3000
bun run cli qa:security
bun run cli sdk:generate

# Operations & Runbook (Doc 07 & 08)
bun run cli cron:publish
bun run cli db:backup
bun run cli db:restore <backup_file>
bun run cli auth:rotate-key
```

---

## 🔒 Backward Compatibility

The following root entrypoint wrappers are maintained to ensure 100% compatibility with existing Docker Compose configs, CI pipelines, and test suites:
- `docker-compose.yml` $\rightarrow$ `scripts/healthcheck.js`
- `package.json` $\rightarrow$ `scripts/copy-standalone-assets.js`
- `package.json` $\rightarrow$ `scripts/push-tenant-schema.ts`
- `package.json` $\rightarrow$ `scripts/scheduled-publish.ts`
- `package.json` $\rightarrow$ `scripts/seed-permissions.ts`
- `package.json` $\rightarrow$ `scripts/qa-runner.ts`
- `prisma/seed-global.ts` $\rightarrow$ `scripts/seed-all-global.ts`
- `__tests__/lib/platform-storage.test.ts` $\rightarrow$ `scripts/migrate-local-media.ts`
