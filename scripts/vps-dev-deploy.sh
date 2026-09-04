#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SaCMS VPS Live Development Launcher
# Deploys and runs SaCMS in DEVELOPMENT mode on VPS 164.68.116.79
# Domain: sacms.cloud, admin.sacms.cloud, cms.sacms.cloud, api.sacms.cloud
#
# Usage:
#   bash scripts/vps-dev-deploy.sh [SERVER_IP] [SERVER_USER]
# Or run directly on the VPS:
#   cd /opt/sacms && bash scripts/vps-dev-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SERVER_IP="${1:-164.68.116.79}"
SERVER_USER="${2:-root}"
# Branch to deploy — override via env, e.g. `DEPLOY_BRANCH=master bash scripts/vps-dev-deploy.sh`.
# Was hardcoded to "aisacms" everywhere below, silently deploying stale code
# whenever the actual work-in-progress branch (e.g. feature/route-groups)
# differed from that default.
DEPLOY_BRANCH="${DEPLOY_BRANCH:-aisacms}"
TARGET_DIR="/opt/sacms"

echo "========================================================"
echo "🚀 Deploying SaCMS in DEVELOPMENT MODE to ${SERVER_IP}"
echo "Branch: ${DEPLOY_BRANCH}"
echo "Domains: sacms.cloud, admin.sacms.cloud, cms.sacms.cloud, api.sacms.cloud"
echo "========================================================"

# If run directly on the server
if [ "$(hostname -I 2>/dev/null | grep -o "$SERVER_IP" || echo "")" = "$SERVER_IP" ] || [ -f "/opt/sacms/package.json" ]; then
    echo "==> Running directly on VPS..."
    cd /opt/sacms

    echo "==> [1/4] Pulling latest changes from git (branch: ${DEPLOY_BRANCH})..."
    git fetch origin "${DEPLOY_BRANCH}"
    git checkout "${DEPLOY_BRANCH}"
    git pull origin "${DEPLOY_BRANCH}"

    echo "==> [2/4] Starting Development Containers (Next.js Dev + Caddy + DB + Redis)..."
    docker compose -f docker-compose.dev.yml up -d --build

    echo "==> [3/4] Running Prisma Database Migrations..."
    sleep 4
    docker compose -f docker-compose.dev.yml exec -T app bun x prisma db push --accept-data-loss || true

    echo "========================================================"
    echo "✨ SaCMS is now running in LIVE DEVELOPMENT mode!"
    echo "🌍 Apex Domain : https://sacms.cloud"
    echo "⚙️ Admin Hub   : https://admin.sacms.cloud"
    echo "✍️ CMS Portal  : https://cms.sacms.cloud"
    echo "🌐 Public API  : https://api.sacms.cloud"
    echo "========================================================"
    echo "📊 Streaming Live Logs (Ctrl+C to exit log stream):"
    docker compose -f docker-compose.dev.yml logs -f app
    exit 0
fi

# Remote execution via SSH
echo "==> [1/4] Syncing configuration files to ${SERVER_USER}@${SERVER_IP}:${TARGET_DIR}..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "mkdir -p ${TARGET_DIR}"
scp Caddyfile Dockerfile.dev docker-compose.dev.yml package.json bun.lock "${SERVER_USER}@${SERVER_IP}:${TARGET_DIR}/" || true

echo "==> [2/4] Executing deployment on remote VPS (branch: ${DEPLOY_BRANCH})..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" DEPLOY_BRANCH="${DEPLOY_BRANCH}" bash -s << 'EOF'
set -e
cd /opt/sacms

# Clone or pull repo if git exists
if [ -d ".git" ]; then
    echo "--> Pulling latest code from branch ${DEPLOY_BRANCH}..."
    git fetch origin "${DEPLOY_BRANCH}"
    git checkout "${DEPLOY_BRANCH}"
    git pull origin "${DEPLOY_BRANCH}"
else
    echo "--> Cloning repository (branch: ${DEPLOY_BRANCH})..."
    git clone -b "${DEPLOY_BRANCH}" https://github.com/zonggonau/sacms.git /opt/sacms || true
    cd /opt/sacms
fi

# Generate .env if missing
if [ ! -f .env ]; then
    echo "--> Generating .env for sacms.cloud..."
    # Random per-deploy Postgres password — this used to be a hardcoded
    # string ("Z0ngg0n4U_SecurePass") committed to this script, meaning
    # every server ever bootstrapped this way shared the same DB password.
    GENERATED_DB_PASSWORD="$(openssl rand -hex 24)"
    cat <<ENVEOF > .env
NODE_ENV=development
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=https://sacms.cloud
NEXT_PUBLIC_APP_URL=https://sacms.cloud
NEXT_PUBLIC_ROOT_DOMAIN=sacms.cloud
NEXTAUTH_COOKIE_DOMAIN=.sacms.cloud
PUBLIC_GATEWAY_IP=164.68.116.79
PUBLIC_CNAME_TARGET=cname.sacms.cloud

POSTGRES_USER=sacms
POSTGRES_PASSWORD=${GENERATED_DB_PASSWORD}
POSTGRES_DB=sacms
DATABASE_URL=postgresql://sacms:${GENERATED_DB_PASSWORD}@postgres:5432/sacms?schema=public
DIRECT_URL=postgresql://sacms:${GENERATED_DB_PASSWORD}@postgres:5432/sacms?schema=public

REDIS_URL=redis://redis:6379
ENVEOF
    chmod 600 .env
fi

echo "--> Launching dev container stack (Hot reload & interactive error trace enabled)..."
docker compose -f docker-compose.dev.yml up -d --build

echo "--> Applying database schema push..."
sleep 4
docker compose -f docker-compose.dev.yml exec -T app bun x prisma db push --accept-data-loss || true

echo "--> Checking container status:"
docker compose -f docker-compose.dev.yml ps
EOF

echo "========================================================"
echo "✨ SaCMS is now running in LIVE DEVELOPMENT MODE on ${SERVER_IP}!"
echo "To monitor live logs in real-time:"
echo "   ssh ${SERVER_USER}@${SERVER_IP} \"cd /opt/sacms && docker compose -f docker-compose.dev.yml logs -f app\""
echo "========================================================"
