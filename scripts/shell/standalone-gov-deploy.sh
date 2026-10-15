#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SaCMS Standalone Deploy — single-institution appliance (e.g. a government
# server), SEPARATE from scripts/shell/vps-setup.sh (which is hardcoded to
# our own live SaaS VPS at 164.68.116.79/developer.sacms.cloud — do not reuse
# that script for a customer's own box).
#
# Everything the institution's one tenant needs (Postgres, MinIO) runs in the
# SAME docker-compose.yml already used in production — nothing new to stand
# up, just the right profiles + env vars.
#
# Run this ON THE INSTITUTION'S SERVER, from the repo root, as the SaCMS team
# (per the licensing model, we run this — not the institution). docker-compose.yml
# and this repo must already be present (copied/cloned there beforehand).
#
# Usage:
#   ./scripts/shell/standalone-gov-deploy.sh "<LICENSE_KEY string>" "https://cms.instansi.go.id"
#
# IMPORTANT — generate the license key SEPARATELY, on OUR OWN systems, before
# running this:
#   - Use /admin/enterprise/licenses on OUR production SaaS (the one database
#     that has license-private.pem mounted via docker-compose.license-signing.yml).
#   - Do NOT run that "Generate" flow on this box. This box never gets the
#     private key, so its own EnterpriseLicense table stays empty for this
#     license — that's what makes the license "not revocable by the
#     institution's own admin" true by construction, not just a UI gate.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

LICENSE_KEY_ARG="${1:-}"
APP_URL="${2:-}"

if [ -z "$LICENSE_KEY_ARG" ] || [ -z "$APP_URL" ]; then
  echo "Usage: $0 \"<LICENSE_KEY>\" \"<https://public-url-for-this-install>\""
  echo "Generate the LICENSE_KEY from OUR OWN /admin/enterprise/licenses — never from this box."
  exit 1
fi

echo "========================================================"
echo "🚀 SaCMS Standalone Appliance Deploy"
echo "========================================================"

if [ ! -f docker-compose.yml ]; then
  echo "❌ Run this from the repo root (docker-compose.yml not found here)."
  exit 1
fi

echo "==> [1/5] Writing .env..."
if [ -f .env ]; then
  echo "⚠️  .env already exists — leaving it untouched. Delete it first if you want a fresh one."
else
  RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
  CRON_RANDOM=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
  DB_RANDOM_SECRET=$(openssl rand -hex 24 2>/dev/null || date +%s%N | sha256sum | head -c 48)
  MINIO_ROOT_USER_RANDOM="sacms_$(openssl rand -hex 6 2>/dev/null || date +%s%N | sha256sum | head -c 12)"
  MINIO_ROOT_PASS_RANDOM=$(openssl rand -hex 24 2>/dev/null || date +%s%N | sha256sum | head -c 48)
  S3_ACCESS_KEY_RANDOM="sacms_$(openssl rand -hex 8 2>/dev/null || date +%s%N | sha256sum | head -c 16)"
  S3_SECRET_KEY_RANDOM=$(openssl rand -hex 24 2>/dev/null || date +%s%N | sha256sum | head -c 48)

  cat <<EOF > .env
NODE_ENV=production
NEXTAUTH_SECRET=${RANDOM_SECRET}
NEXTAUTH_URL=${APP_URL}
NEXT_PUBLIC_APP_URL=${APP_URL}

# Database (bundled postgres service in docker-compose.yml — runs on this
# same box, not our shared SaaS pool)
POSTGRES_USER=sacms
POSTGRES_PASSWORD=${DB_RANDOM_SECRET}
POSTGRES_DB=sacms
DATABASE_URL=postgresql://sacms:${DB_RANDOM_SECRET}@postgres:5432/sacms?schema=public
DIRECT_URL=postgresql://sacms:${DB_RANDOM_SECRET}@postgres:5432/sacms?schema=public

REDIS_URL=redis://redis:6379

# Single-tenant appliance: relaxes the custom-domain plan limit (unrelated to
# the license bypass below, which already covers every other limit).
SELFHOST_MODE=true

# Enterprise license — generated on OUR OWN system, never on this box. See
# the header comment in this script. LICENSE_SERVER_URL intentionally left
# unset: this install validates offline only (RSA signature + expiry), no
# outbound internet call required. Set it later if/when online re-validation
# is wanted.
LICENSE_KEY=${LICENSE_KEY_ARG}

CRON_SECRET=${CRON_RANDOM}

# Object storage (bundled minio service, profile "storage" — runs on this
# same box). minio-init provisions the bucket + this access key on first boot.
MINIO_ROOT_USER=${MINIO_ROOT_USER_RANDOM}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASS_RANDOM}
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_RANDOM}
S3_SECRET_ACCESS_KEY=${S3_SECRET_KEY_RANDOM}
S3_BUCKET=sacms-media
S3_REGION=us-east-1
# Adjust once you decide how media is served publicly from this box (e.g.
# behind a reverse proxy at a subdomain) — left blank is fine to start.
S3_PUBLIC_URL=
EOF
  chmod 600 .env
  echo "Created .env."
fi

echo "==> [2/5] Starting app + postgres + minio + cron..."
docker compose --profile storage --profile cron up -d

echo "==> [3/5] Applying database schema..."
docker compose run --rm app bun x prisma db push --skip-generate

echo "==> [4/5] Seeding RBAC permissions..."
docker compose run --rm app bun run seed:permissions

echo "==> [5/5] Health check..."
sleep 3
curl -sf "http://127.0.0.1:3000/api/health" > /dev/null && echo "✅ App is up." || echo "⚠️  Health check failed — check 'docker compose logs app'."

echo "========================================================"
echo "✨ Deploy complete."
echo "Next step (do this, not a script — normal onboarding flow):"
echo "  1. Open ${APP_URL}/register and create the institution's first admin"
echo "     account (it automatically becomes super_admin, since this is a"
echo "     fresh database)."
echo "  2. Create their first workspace from the dashboard as usual — the"
echo "     license bypass (unlimited everything) already applies to it"
echo "     automatically via the LICENSE_KEY in .env, no extra setup needed."
echo "========================================================"
