# SaCMS

SaCMS is a multi-tenant headless CMS with built-in workspace billing, RBAC, AI authoring, white-label branding, custom domains, and public REST/GraphQL delivery.

If you want the canonical system overview, start with:

- [docs/00-README.md](docs/00-README.md)
- [docs/02-Software_Requirement_Specification.md](docs/02-Software_Requirement_Specification.md)
- [docs/11-User_Manual_and_Integrations.md](docs/11-User_Manual_and_Integrations.md)
- [docs/15-Implementation_Traceability.md](docs/15-Implementation_Traceability.md)

## Current canonical plan rules

Account plans limit how many workspaces a user can own:

- Free: 1 workspace
- Starter: 3 workspaces
- Pro: 10 workspaces
- Enterprise: 20 workspaces
- Custom: override via approved tenant/user override

Workspace plans limit content and platform usage:

- Free: 3 content types, 500 entries, 1 team member, 100MB storage, 1 locale, 1,000 API calls/month
- Starter: 5 content types, 5,000 entries, 3 team members, 1GB storage, 2 locales, 10,000 API calls/month
- Pro: 10 content types, 10,000 entries, 10 team members, 5GB storage, 5 locales, 100,000 API calls/month
- Enterprise: 20 content types, 20,000 entries, 20 team members, 10GB storage, 20 locales, 1,000,000 API calls/month
- Custom: override via `CustomPlanOverride`

Edge rate limiting is separate from monthly API caps:

- Free: 100 requests/minute
- Pro: 500 requests/minute
- Enterprise/Custom: configured per deployment

## Getting started

## Getting started

```bash
bun install
bun run db:generate
bun run db:push
bun run dev
```

## Useful scripts & Developer CLI

SaCMS menyertakan antarmuka CLI terpadu untuk otomasi database, seeder, migrasi, dan QA:

```bash
# Tampilkan menu bantuan seluruh skrip
bun run cli help

# Seeding & Inisialisasi
bun run cli seed:global         # Seed master content types, components & data
bun run cli seed:permissions    # Seed matriks izin RBAC & default role
bun run cli seed:workflow       # Seed izin transisi workflow (Doc 14)
bun run cli seed:plans          # Seed tier paket workspace & langganan

# Migrasi & Dedicated DB
bun run cli migrate:tenant demo # Push skema ke database dedicated tenant
bun run cli migrate:media       # Migrasi media lokal ke Cloudflare R2 / MinIO
bun run cli migrate:fts         # Setup index PostgreSQL Full-Text Search

# QA & Pengujian
bun run cli qa:audit            # Audit kesehatan route & latensi real-time
bun run cli qa:security         # Security smoke tests (SSRF, auth gates)
bun run test                    # Jalankan test suite Vitest (307 tests 100% PASS)

# Operasional & Backup
bun run cli cron:publish        # Eksekusi scheduled publishing worker
bun run cli db:backup           # Backup database harian dengan rotasi 7 hari
```

Panduan lengkap arsitektur skrip tersedia di [scripts/README.md](./scripts/README.md).  
Untuk deployment guide, runbook, dan spesifikasi API, rujuk ke [docs/00-README.md](./docs/00-README.md).

