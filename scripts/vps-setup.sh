#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SaCMS VPS Bootstrap & Provisioning Script
# Target: Ubuntu / Debian Linux VPS (e.g. 164.68.116.79)
#
# Usage (run on the VPS as root or with sudo):
#   curl -sSL https://raw.githubusercontent.com/<owner>/sacms/master/scripts/vps-setup.sh | bash
# Or locally via SSH:
#   ssh root@164.68.116.79 "bash -s" < scripts/vps-setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "========================================================"
echo "🚀 SaCMS Production VPS Initializer (164.68.116.79)"
echo "========================================================"

# 1. Update OS packages
echo "==> [1/6] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw ca-certificates gnupg lsb-release htop unzip

# 2. Install Docker Engine & Docker Compose
echo "==> [2/6] Installing Docker & Docker Compose Plugin..."
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully: $(docker --version)"
else
    echo "Docker already installed: $(docker --version)"
fi

# 3. Setup Firewall (UFW)
echo "==> [3/6] Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy/Certbot)'
ufw allow 443/tcp comment 'HTTPS (Caddy/SSL)'
ufw allow 81/tcp comment 'SaCMS Custom Port Gateway'
# Enable UFW non-interactively
ufw --force enable
echo "Firewall active and ports 22, 80, 443, 81 open."

# 4. Create App Directory Structure
echo "==> [4/6] Creating directory structure at /opt/sacms..."
mkdir -p /opt/sacms/db/backups
mkdir -p /opt/sacms/caddy_data
mkdir -p /opt/sacms/caddy_config
cd /opt/sacms

# 5. Generate .env file if not exists
echo "==> [5/6] Checking production environment file..."
if [ ! -f /opt/sacms/.env ]; then
    echo "Generating default production /opt/sacms/.env..."
    RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
    cat <<EOF > /opt/sacms/.env
# SaCMS Production Environment for 164.68.116.79
NODE_ENV=production
NEXTAUTH_SECRET=${RANDOM_SECRET}
NEXTAUTH_URL=http://164.68.116.79
PUBLIC_GATEWAY_IP=164.68.116.79

# Database Configuration (PostgreSQL 17)
POSTGRES_USER=sacms
POSTGRES_PASSWORD=Z0ngg0n4U_Secure_${RANDOM_SECRET:0:8}
POSTGRES_DB=sacms
DATABASE_URL=postgresql://sacms:Z0ngg0n4U_Secure_${RANDOM_SECRET:0:8}@postgres:5432/sacms
DIRECT_URL=postgresql://sacms:Z0ngg0n4U_Secure_${RANDOM_SECRET:0:8}@postgres:5432/sacms

# Redis
REDIS_URL=redis://redis:6379

# Self-Hosted Mode (Enterprise)
SELFHOST_MODE=true
EOF
    chmod 600 /opt/sacms/.env
    echo "Created /opt/sacms/.env with secure credentials."
else
    echo "/opt/sacms/.env already exists. Preserving existing configuration."
fi

# 6. Verify Docker & System Health
echo "==> [6/6] Verifying Docker daemon status..."
docker ps > /dev/null
echo "========================================================"
echo "✨ VPS Setup Complete! Server 164.68.116.79 is ready for CI/CD."
echo "Directory: /opt/sacms"
echo "========================================================"
