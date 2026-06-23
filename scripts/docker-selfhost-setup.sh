#!/bin/bash
# ============================================================
# SaCMS Self-Hosted Docker Setup Script
# ============================================================
# Usage: bash scripts/docker-selfhost-setup.sh
#
# This script:
# 1. Generates .env if not present
# 2. Starts Docker Compose services
# 3. Waits for PostgreSQL to be healthy
# 4. Runs Prisma migrations inside the container
# 5. Creates the admin user
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🐳 SaCMS Self-Hosted Docker Setup            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Generate .env if not exists ────────────────────────────────
if [ ! -f .env ]; then
  echo -e "${YELLOW}No .env file found. Generating with default values...${NC}"
  
  NEXTAUTH_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)
  POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
  CRON_SECRET=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
  
  cat > .env << EOF
# SaCMS Self-Hosted Docker Configuration
SELFHOST_MODE=true
DATABASE_URL=postgresql://sacms:${POSTGRES_PASSWORD}@postgres:5432/sacms
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=http://localhost:3000
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
CRON_SECRET=${CRON_SECRET}
LICENSE_KEY=
EOF
  
  echo -e "${GREEN}✅ .env file generated${NC}"
  echo -e "${YELLOW}⚠  Edit .env to add your LICENSE_KEY and other settings${NC}"
else
  echo -e "${GREEN}✅ .env file found${NC}"
fi

# Source .env
export $(grep -v '^#' .env | xargs)

# ─── Start Docker Compose ───────────────────────────────────────
echo ""
echo -e "${BLUE}Starting Docker services...${NC}"
docker compose -f docker-compose.enterprise.yml up -d

# ─── Wait for PostgreSQL ────────────────────────────────────────
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
  if docker compose -f docker-compose.enterprise.yml exec -T postgres pg_isready -U sacms > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}✖ PostgreSQL failed to start in 30 seconds${NC}"
    exit 1
  fi
  sleep 1
done

# ─── Run Prisma Migrations ──────────────────────────────────────
echo ""
echo -e "${BLUE}Running database migrations...${NC}"
docker compose -f docker-compose.enterprise.yml exec -T app bunx prisma db push --accept-data-loss 2>/dev/null || \
docker compose -f docker-compose.enterprise.yml exec -T app npx prisma db push --accept-data-loss

echo -e "${GREEN}✅ Database schema applied${NC}"

# ─── Create Admin User ──────────────────────────────────────────
echo ""
echo -e "${BLUE}Creating admin user...${NC}"

read -p "Admin email (admin@localhost): " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@localhost}

read -p "Admin name (Admin): " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Admin}

read -sp "Admin password (admin123): " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
echo ""

docker compose -f docker-compose.enterprise.yml exec -T app bun -e "
const { PrismaClient } = require('./prisma/generated-client');
const bcrypt = require('bcrypt');
(async () => {
  const db = new PrismaClient();
  const hash = await bcrypt.hash('${ADMIN_PASSWORD}', 12);
  const user = await db.user.upsert({
    where: { email: '${ADMIN_EMAIL}' },
    update: { name: '${ADMIN_NAME}', password: hash, role: 'super_admin', plan: 'enterprise', emailVerified: new Date() },
    create: { email: '${ADMIN_EMAIL}', name: '${ADMIN_NAME}', password: hash, role: 'super_admin', plan: 'enterprise', emailVerified: new Date() },
  });
  console.log('Admin created: ' + user.email);
  await db.\$disconnect();
})().catch(console.error);
"

echo -e "${GREEN}✅ Admin user created${NC}"

# ─── Done ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ SaCMS Self-Hosted is running!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Open: ${BLUE}http://localhost:3000/dashboard${NC}"
echo -e "  Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
echo ""
echo -e "  ${YELLOW}Manage:${NC}"
echo -e "    docker compose -f docker-compose.enterprise.yml logs -f"
echo -e "    docker compose -f docker-compose.enterprise.yml stop"
echo -e "    docker compose -f docker-compose.enterprise.yml down"
echo ""
