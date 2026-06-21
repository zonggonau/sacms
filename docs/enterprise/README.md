# SaCMS Enterprise Self-Hosting

**Version:** 1.2.0+  
**License:** Annual subscription — contact sales@sacms.cloud

---

## Overview

SaCMS Enterprise Self-Hosting allows organizations to deploy and run SaCMS on their own infrastructure. This is ideal for:

- **Government agencies** requiring data sovereignty
- **Enterprises** with strict compliance requirements
- **Partners** who want to offer SaCMS as a white-label service

## Key Features

| Feature | Detail |
|---|---|
| **Unlimited Workspaces** | No workspace/account plan limits |
| **Unlimited Team Members** | Add as many users as needed |
| **Unlimited Storage** | Storage is your own hardware limit |
| **Unlimited API Calls** | No request quotas |
| **Full Feature Access** | All features unlocked |
| **Priority Support** | Dedicated support channel |
| **Annual License** | Simple yearly renewal |

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB SSD | 50+ GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Docker | 24+ | 27+ |
| Domain | Optional | Recommended for SSL |

## Installation

### 1. Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 2. Download SaCMS Enterprise

```bash
# Create project directory
mkdir /opt/sacms-enterprise
cd /opt/sacms-enterprise

# Download Docker Compose
curl -O https://raw.githubusercontent.com/zonggonau/sacms/main/docker-compose.enterprise.yml

# Download environment template
curl -O https://raw.githubusercontent.com/zonggonau/sacms/main/.env.enterprise.example
cp .env.enterprise.example .env
```

### 3. Configure Environment

Edit `.env`:

```env
# Required
DATABASE_URL="postgresql://sacms:your-password@postgres:5432/sacms?schema=public"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
POSTGRES_PASSWORD="your-strong-password"

# Your Enterprise License Key
LICENSE_KEY="<paste your serial key here>"
```

### 4. Start the System

```bash
docker compose -f docker-compose.enterprise.yml up -d
```

### 5. Run Database Migrations

```bash
docker exec -it sacms-enterprise-app-1 npx prisma db push
# or (first time)
docker compose -f docker-compose.enterprise.yml exec app npx prisma db push
```

### 6. Verify Installation

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "node_env": "production",
  "database": "ok"
}
```

Check license status:
```bash
curl http://localhost:3000/api/enterprise/status
```

Expected response:
```json
{
  "valid": true,
  "status": "active",
  "customerName": "Your Organization",
  "daysRemaining": 360
}
```

### 7. Setup Reverse Proxy (Optional)

**With Nginx:**
```nginx
server {
    listen 80;
    server_name cms.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**With Caddy (automatic SSL):**
```caddyfile
cms.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## License Management

### View License Status

Access **Settings → License** in the SaCMS admin dashboard.

### Activate License

1. Go to **Settings → License**
2. Click **Activate License**
3. Paste your serial key
4. Click **Activate**

### Renew License

1. Contact sales@sacms.cloud for renewal
2. You'll receive a new serial key
3. Update `.env` with the new key:
   ```
   LICENSE_KEY="SACMS-<new-key>"
   ```
4. Restart the service:
   ```bash
   docker compose -f docker-compose.enterprise.yml restart app
   ```

## Updates

```bash
cd /opt/sacms-enterprise
docker compose -f docker-compose.enterprise.yml pull app
docker compose -f docker-compose.enterprise.yml up -d
```

## Backup

Backups run automatically every 24 hours (stored in `./backups/`).

Manual backup:
```bash
docker compose -f docker-compose.enterprise.yml exec postgres pg_dump -U sacms -Fc sacms > backup_$(date +%Y%m%d).dump
```

Restore:
```bash
docker compose -f docker-compose.enterprise.yml exec -T postgres pg_restore -U sacms -d sacms < backup_20260101.dump
```

## Support

| Channel | Contact |
|---|---|
| Email | support@sacms.cloud |
| License Inquiries | sales@sacms.cloud |
| Documentation | https://sacms.cloud/docs |

## FAQ

**Q: Can I use my own domain?**  
A: Yes. We recommend using Caddy for automatic SSL.

**Q: Is the license per server or per instance?**  
A: Per instance. Contact us for multi-instance pricing.

**Q: What happens when my license expires?**  
A: The system will show a warning banner. Enterprise features remain active for 7 days as a grace period.

**Q: Can I upgrade from self-hosted to SaCMS Cloud?**  
A: Yes. Contact support for migration assistance.

**Q: Do I need internet access?**  
A: Only for initial activation and periodic license validation (can be disabled for air-gapped environments).
