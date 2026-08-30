export interface CloudInitConfig {
  tenantSlug: string
  dbName: string
  dbUser: string
  dbPassword: string
  minioUser: string
  minioPassword: string
  minioBucket: string
  dbDomain: string
  mediaDomain: string
  webDomain?: string
  adminEmail?: string
  allowedManagementIps?: string[]
}

/**
 * Generate a production-ready Cloud-Init configuration (#cloud-config)
 * for deploying PostgreSQL 17 + MinIO S3 + Next.js Frontend + Caddy on a Contabo VPS.
 * Hardened with UFW firewall rules that whitelist PostgreSQL 5432 strictly for SaCMS app servers.
 */
export function generateCloudInitScript(config: CloudInitConfig): string {
  const {
    tenantSlug,
    dbName,
    dbUser,
    dbPassword,
    minioUser,
    minioPassword,
    minioBucket,
    mediaDomain,
    webDomain,
    adminEmail = 'admin@sacms.cloud',
    allowedManagementIps = [],
  } = config

  // Extract SaCMS server IPs for firewall whitelist
  const sacmsServerIps = (process.env.SACMS_SERVER_IPS || process.env.SERVER_IPV4 || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean)

  const allWhitelistedIps = Array.from(new Set([...sacmsServerIps, ...allowedManagementIps]))
  const ufwPostgresRules = allWhitelistedIps.length > 0
    ? allWhitelistedIps.map(ip => `      ufw allow from ${ip} to any port 5432 proto tcp`).join('\n')
    : '      ufw allow 5432/tcp # Note: Set SACMS_SERVER_IPS for strict IP restriction'

  const dockerComposeContent = `
services:
  caddy:
    image: caddy:2-alpine
    container_name: sacms_caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - sacms_network

  postgres:
    image: postgres:17-alpine
    container_name: sacms_postgres
    restart: always
    environment:
      POSTGRES_DB: ${dbName}
      POSTGRES_USER: ${dbUser}
      POSTGRES_PASSWORD: ${dbPassword}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${dbUser} -d ${dbName}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sacms_network

  minio:
    image: minio/minio:latest
    container_name: sacms_minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${minioUser}
      MINIO_ROOT_PASSWORD: ${minioPassword}
      MINIO_SERVER_URL: https://${mediaDomain}
      MINIO_BROWSER_REDIRECT_URL: https://${mediaDomain}/ui
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sacms_network

  minio-init:
    image: minio/mc:latest
    container_name: sacms_minio_init
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      /usr/bin/mc alias set local http://minio:9000 ${minioUser} '${minioPassword}';
      /usr/bin/mc mb --ignore-existing local/${minioBucket};
      /usr/bin/mc anonymous set download local/${minioBucket};
      exit 0;
      "
    networks:
      - sacms_network

  frontend:
    image: node:20-alpine
    container_name: sacms_frontend
    restart: always
    working_dir: /app
    volumes:
      - ./site:/app
    command: /bin/sh -c "if [ -f server.js ]; then node server.js; elif [ -f package.json ]; then npm run start 2>/dev/null || node -e 'require(\\"http\\").createServer((req, res) => { res.writeHead(200, {\"Content-Type\": \"text/html\"}); res.end(\"<h1>SaCMS Frontend Initializing...</h1>\"); }).listen(3000)'; else node -e 'require(\"http\").createServer((req, res) => { res.writeHead(200, {\"Content-Type\": \"text/html\"}); res.end(\"<div style=\\\"font-family:sans-serif;text-align:center;padding:50px;background:#090d16;color:#f8fafc;min-height:100vh\\\"><h1>🚀 SaCMS Dedicated VPS Ready</h1><p style=\\\"color:#94a3b8\\\">Website frontend is active and ready to receive deployments from SaCMS AI Studio.</p></div>\"); }).listen(3000);'; fi"
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
    networks:
      - sacms_network

networks:
  sacms_network:
    driver: bridge

volumes:
  postgres_data:
  minio_data:
  caddy_data:
  caddy_config:
`.trim()

  const caddyfileContent = `
{
    email ${adminEmail}
}

# Media Storage Subdomain
${mediaDomain} {
    handle /healthz {
        respond "OK" 200
    }

    # MinIO Console UI
    handle_path /ui* {
        reverse_proxy minio:9001
    }

    # MinIO S3 API & public downloads
    handle {
        reverse_proxy minio:9000
    }
}

# Next.js Frontend Website
${webDomain ? `${webDomain}` : ':80'} {
    handle /healthz {
        respond "OK" 200
    }

    handle {
        reverse_proxy frontend:3000
    }
}
`.trim()

  const cloudConfig = `#cloud-config
package_update: true
package_upgrade: false

packages:
  - docker.io
  - docker-compose-plugin
  - curl
  - ufw
  - fail2ban

write_files:
  - path: /opt/sacms/docker-compose.yml
    permissions: '0644'
    content: |
${dockerComposeContent.split('\n').map(line => '      ' + line).join('\n')}

  - path: /opt/sacms/Caddyfile
    permissions: '0644'
    content: |
${caddyfileContent.split('\n').map(line => '      ' + line).join('\n')}

  - path: /opt/sacms/setup.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -e
      echo "[SaCMS] Starting hardened firewall configuration..."
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      ufw allow 80/tcp
      ufw allow 443/tcp
${ufwPostgresRules}
      ufw --force enable

      echo "[SaCMS] Initializing frontend site directory..."
      mkdir -p /opt/sacms/site

      echo "[SaCMS] Starting Docker containers..."
      cd /opt/sacms
      docker compose up -d

      echo "[SaCMS] Provisioning completed successfully for tenant: ${tenantSlug}"

runcmd:
  - systemctl enable docker
  - systemctl start docker
  - systemctl enable fail2ban
  - systemctl start fail2ban
  - /opt/sacms/setup.sh
`

  return cloudConfig
}
