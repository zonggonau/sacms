# SaCMS Self-Hosted Installation Guide

Deploy your own instance of SaCMS — a powerful headless CMS with multi-tenant support, AI content generation, and enterprise features.

## Quick Start (3 commands)

```bash
# 1. Clone & install
git clone https://github.com/zonggonau/sacms.git && cd sacms && bun install

# 2. Run the setup wizard
bunx tsx scripts/selfhost-setup.ts

# 3. Build & start
bun run build && bun run start
```

Open `http://localhost:3000/dashboard` and login with your admin credentials.

---

## Docker Method (Recommended for Production)

### Prerequisites
- Docker & Docker Compose
- (Optional) Enterprise License Key

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/zonggonau/sacms.git
cd sacms

# 2. Run Docker setup script
bash scripts/docker-selfhost-setup.sh
```

This will:
- Generate `.env` with secure random secrets
- Start PostgreSQL, Redis, and SaCMS containers
- Run database migrations
- Create your admin user

### Manual Docker Setup

```bash
# 1. Copy and edit environment file
cp .env.example .env
# Edit .env — set SELFHOST_MODE="true" and your DATABASE_URL

# 2. Start services
docker compose -f docker-compose.enterprise.yml up -d

# 3. Run migrations
docker compose -f docker-compose.enterprise.yml exec app bunx prisma db push

# 4. Open browser
open http://localhost:3000/dashboard
```

---

## Manual Method (Development)

### Prerequisites
- [Bun](https://bun.sh) >= 1.0 (or Node.js >= 20)
- PostgreSQL >= 15
- (Optional) Redis for rate limiting & caching

### Steps

```bash
# 1. Clone
git clone https://github.com/zonggonau/sacms.git
cd sacms

# 2. Install dependencies
bun install

# 3. Run interactive setup
bunx tsx scripts/selfhost-setup.ts

# 4. Or manual setup:
cp .env.example .env
# Edit .env:
#   SELFHOST_MODE="true"
#   DATABASE_URL="postgresql://user:pass@localhost:5432/sacms"
#   NEXTAUTH_SECRET="<random-secret>"

# 5. Setup database
bunx prisma generate
bunx prisma db push

# 6. Build & start
bun run build
bun run start
```

---

## Configuration Reference

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SELFHOST_MODE` | Enable self-hosted mode | `"true"` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/sacms` |
| `NEXTAUTH_SECRET` | Session encryption secret (min 32 chars) | `<random-hex>` |
| `NEXTAUTH_URL` | Your application URL | `https://cms.yourdomain.com` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LICENSE_KEY` | Enterprise license key | _(none)_ |
| `LICENSE_SERVER_URL` | License validation server | `https://license.sacms.cloud` |
| `CRON_SECRET` | Secret for cron job endpoints | _(auto-generated)_ |
| `S3_ENDPOINT` | S3-compatible storage endpoint | _(none — uses local)_ |
| `S3_BUCKET` | Storage bucket name | _(none)_ |
| `S3_ACCESS_KEY_ID` | Storage access key | _(none)_ |
| `S3_SECRET_ACCESS_KEY` | Storage secret key | _(none)_ |
| `S3_PUBLIC_URL` | Public URL for serving media | _(none)_ |
| `OPENAI_API_KEY` | OpenAI API key for AI features | _(none)_ |

---

## What's Different in Self-Hosted Mode?

When `SELFHOST_MODE=true`:

| Feature | SaaS Mode | Self-Hosted Mode |
|---------|-----------|-----------------|
| Landing Page | ✅ Active | ❌ Redirects to `/dashboard` |
| SaaS Billing | ✅ Midtrans/Stripe | ❌ Disabled (unlimited) |
| Plan Limits | ✅ Enforced per plan | ❌ Bypassed (unlimited) |
| Admin Panel | ✅ Super admin UI | ❌ Hidden |
| Dashboard | ✅ Multi-workspace | ✅ Auto-redirects if single workspace |
| Public API | ✅ Active | ✅ Active |
| Auth | ✅ Active | ✅ Active |
| Enterprise License | ✅ Optional | ✅ Optional (unlocks extra features) |
| Setup Wizard | — | ✅ First-run `/dashboard/setup` |

---

## Enterprise License

Enterprise licenses unlock additional features and remove any remaining limits.

### Activating via Environment
```env
LICENSE_KEY="SACMS-xxxxx.yyyyy"
```

### Activating via Web UI
1. Go to `/dashboard/setup`
2. Enter your license key
3. Click "Activate"

### Getting a License
Contact [sales@sacms.cloud](mailto:sales@sacms.cloud) or visit [sacms.cloud/pricing](https://sacms.cloud/pricing).

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set a strong `NEXTAUTH_SECRET` (min 32 chars random)
- [ ] Set `NEXTAUTH_URL` to your actual domain (e.g., `https://cms.yourdomain.com`)
- [ ] Configure a reverse proxy (Caddy, Nginx) with HTTPS
- [ ] Configure S3/R2 storage for media files
- [ ] Set up automated database backups
- [ ] Configure Redis for rate limiting (recommended)
- [ ] Set up cron jobs for scheduled publishing:
  ```bash
  # Every 5 minutes
  curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/publish
  ```

---

## Updating

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
bun install

# Apply database changes
bunx prisma db push

# Rebuild
bun run build

# Restart
bun run start
```

For Docker:
```bash
docker compose -f docker-compose.enterprise.yml pull
docker compose -f docker-compose.enterprise.yml up -d
docker compose -f docker-compose.enterprise.yml exec app bunx prisma db push
```

---

## Troubleshooting

### "Database connection failed"
- Ensure PostgreSQL is running and accessible
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/database`
- Ensure the database exists: `createdb sacms`

### "Cannot find module 'prisma/generated-client'"
```bash
bunx prisma generate
```

### "SELFHOST_MODE not detected"
- Ensure `.env` has `SELFHOST_MODE="true"` (with quotes)
- Restart the application after changing `.env`

### "License activation failed"
- Verify the license key format starts with `SACMS-`
- Ensure `keys/license-public.pem` exists in the project root
- Check online: `curl https://license.sacms.cloud/api/enterprise/validate`

---

## Support

- **Documentation**: [docs.sacms.cloud](https://docs.sacms.cloud)
- **Issues**: [github.com/zonggonau/sacms/issues](https://github.com/zonggonau/sacms/issues)
- **Email**: [support@sacms.cloud](mailto:support@sacms.cloud)
