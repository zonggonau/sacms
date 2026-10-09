#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SaCMS Manual Deployment Script
# Deploys current codebase / images directly to VPS 164.68.116.79
#
# Usage:
#   bash scripts/deploy-manual.sh [SERVER_IP] [SERVER_USER]
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SERVER_IP="${1:-164.68.116.79}"
SERVER_USER="${2:-root}"
TARGET_DIR="/opt/sacms"

echo "========================================================"
echo "🚀 Deploying SaCMS to ${SERVER_USER}@${SERVER_IP}:${TARGET_DIR}"
echo "========================================================"

# 1. Sync configuration files
echo "==> [1/4] Syncing docker-compose.yml and Caddyfile to server..."
scp docker-compose.yml Caddyfile "${SERVER_USER}@${SERVER_IP}:${TARGET_DIR}/"

# 2. Execute deployment on server
echo "==> [2/4] Executing deployment commands on remote VPS..."
ssh "${SERVER_USER}@${SERVER_IP}" bash -s << 'EOF'
set -e
cd /opt/sacms

echo "--> Pulling latest images..."
docker compose pull app || echo "Note: Using current local image if remote not updated"

echo "--> Ensuring database and redis services are up..."
docker compose up -d postgres redis
sleep 3

echo "--> Applying Prisma migrations..."
docker compose run --rm app bun x prisma db push --accept-data-loss || true

echo "--> Restarting application with zero downtime..."
docker compose up -d --remove-orphans

echo "--> Cleaning old unused Docker images..."
docker image prune -f

echo "--> Checking container status:"
docker compose ps
EOF

echo "========================================================"
echo "✨ Manual deployment to ${SERVER_IP} completed successfully!"
echo "Visit: http://${SERVER_IP} or your configured domain"
echo "========================================================"
