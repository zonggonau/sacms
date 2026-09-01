# SaCMS — Project Guide & Architecture Blueprint

## 🏗️ Production Architecture Blueprint

```
[ Local Development ]
PC / Laptop
  └── Bun (`bun run dev`) + Local PostgreSQL & Redis
          │
          ▼
   ( `git push` )
          │
          ▼
[ Cloud CI/CD ]
GitHub Repository (zonggonau/sacms)
  └── GitHub Actions Runner (.github/workflows/ci.yml)
          ├── 1. Bun Install (Cached)
          ├── 2. Prisma Generate
          ├── 3. Vitest Suite (158 Automated Tests)
          ├── 4. Next.js Standalone Turbo Compile (~30s)
          └── 5. Build Lightweight OCI Container (5s)
          │
          ▼
[ Container Registry ]
GitHub Container Registry (GHCR)
  └── ghcr.io/zonggonau/sacms:latest (~200MB)
          │
          ▼ (SSH Zero-Downtime Deploy)
[ Production Server — VPS (164.68.116.79) ]
/opt/sacms
  ├── Caddy Gateway (Auto SSL / TLS Termination & Wildcard Custom Domains)
  │       │
  │       ▼
  ├── SaCMS App Service (`bun server.js` on Standalone Next.js 16)
  │       │
  │       ├── PostgreSQL 17 Database (Shared Pool & Dedicated Tenant Appliance)
  │       ├── Upstash / Local Redis (Cache, Rate Limiting & Domain Edge Proxy)
  │       ├── Cloudflare R2 / S3 Storage (Media Assets & Thumbnails)
  │       └── Automated DB Backup Service (`/opt/sacms/db/backups`)
```

## 🚀 Deploy Configuration (Configured by /setup-deploy)
- **Production Host:** `164.68.116.79` (VPS Ubuntu 24.04 LTS)
- **Live URL:** https://sacms.cloud
- **App Working Directory:** `/opt/sacms`
- **Reverse Proxy & SSL:** Caddy (`/opt/sacms/Caddyfile`)
- **Docker Compose:** `/opt/sacms/docker-compose.yml`
- **Deploy Workflow:** `.github/workflows/ci.yml`
- **Deploy Triggers:** Automatic on push to `master`, `develop`, `aisacms`
- **Health Check Endpoint:** `https://sacms.cloud/api/health`
- **Total Pipeline Execution Time:** **~90 seconds (1.5 menit)**

### Custom Deploy Hooks
- **CI Validation:** `bun run test && bun run build`
- **Database Synchronization:** `docker compose run --rm app bun x prisma db push --skip-generate`
- **RBAC Permission Seed:** `docker compose run --rm app bun run seed:permissions`
- **Post-Deploy Healthcheck:** `curl -sf http://127.0.0.1:3000/api/health`

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
- Configure deploy settings → invoke /setup-deploy
- Build frontend / website with SaCMS MCP → invoke /sacms-frontend-builder

