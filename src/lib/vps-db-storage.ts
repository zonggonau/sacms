import { Client as SshClient } from "ssh2"
import { randomBytes } from "crypto"
import { db } from "@/lib/database"
import { openVpsSupportTicket } from "@/lib/billing/vps-fulfillment"

export interface ProvisionedInfra {
  databaseUrl: string
  storageConfig: { endpoint: string; accessKey: string; secretKey: string; bucket: string; publicUrl: string }
}

function genSecret(bytes = 24): string {
  return randomBytes(bytes).toString("base64url")
}

function genAccessKey(): string {
  return `sacms${randomBytes(8).toString("hex")}`
}

/** Single-quotes a value for SQL — safe here since every value passed through this
 *  module is our own base64url/hex-generated secret (no quotes/backslashes), but
 *  quoted defensively rather than trusted blindly. */
function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * SaCMS's own app server — the only IP that ever needs to reach the
 * Postgres/MinIO this script opens up, so firewall and pg_hba rules are
 * scoped to it instead of 0.0.0.0/0. Configurable via APP_SERVER_IP for a
 * multi-server or non-production deploy; falls back to the production VPS
 * IP from CLAUDE.md's deploy blueprint.
 */
function getAppServerIp(): string {
  return process.env.APP_SERVER_IP || "164.68.116.79"
}

function buildBootstrapScript(creds: { dbPassword: string; minioAccessKey: string; minioSecretKey: string }): string {
  const appIp = getAppServerIp()
  return `set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y postgresql wget curl

systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE sacms;" || true
sudo -u postgres psql -c "CREATE USER sacms_app WITH ENCRYPTED PASSWORD ${sqlQuote(creds.dbPassword)};" || sudo -u postgres psql -c "ALTER USER sacms_app WITH ENCRYPTED PASSWORD ${sqlQuote(creds.dbPassword)};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sacms TO sacms_app;"
PG_CONF=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW config_file;")
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;")
sed -i "s/^#listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
grep -q "host sacms sacms_app ${appIp}/32 md5" "$PG_HBA" || echo "host sacms sacms_app ${appIp}/32 md5" >> "$PG_HBA"
systemctl restart postgresql

id -u minio-user >/dev/null 2>&1 || useradd -r minio-user -s /sbin/nologin
mkdir -p /mnt/minio-data
chown minio-user:minio-user /mnt/minio-data
if [ ! -f /usr/local/bin/minio ]; then
  wget -q -O /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
  chmod +x /usr/local/bin/minio
fi
chown minio-user:minio-user /usr/local/bin/minio

cat > /etc/systemd/system/minio.service <<'UNIT'
[Unit]
Description=MinIO
After=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server /mnt/minio-data --console-address ":9001"
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/default/minio <<'MINIOENV'
MINIO_ROOT_USER=${creds.minioAccessKey}
MINIO_ROOT_PASSWORD=${creds.minioSecretKey}
MINIOENV

systemctl daemon-reload
systemctl enable minio
systemctl restart minio
sleep 3

if [ ! -f /usr/local/bin/mc ]; then
  wget -q -O /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc
  chmod +x /usr/local/bin/mc
fi
/usr/local/bin/mc alias set local http://127.0.0.1:9000 ${creds.minioAccessKey} ${creds.minioSecretKey}
/usr/local/bin/mc mb local/sacms || true
/usr/local/bin/mc anonymous set download local/sacms || true

if command -v ufw >/dev/null 2>&1; then
  ufw allow from ${appIp} to any port 5432 proto tcp || true
  ufw allow from ${appIp} to any port 9000 proto tcp || true
  ufw allow from ${appIp} to any port 9001 proto tcp || true
fi

echo "SACMS_BOOTSTRAP_OK"
`
}

function execViaSsh(host: string, username: string, password: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient()
    const timeout = setTimeout(() => {
      conn.end()
      reject(new Error("Timeout menghubungkan/menjalankan setup via SSH (5 menit)"))
    }, 5 * 60_000)

    conn
      .on("ready", () => {
        conn.exec(script, (err, stream) => {
          if (err) {
            clearTimeout(timeout)
            conn.end()
            reject(err)
            return
          }
          let stderr = ""
          let stdout = ""
          stream
            .on("close", (code: number) => {
              clearTimeout(timeout)
              conn.end()
              if (code === 0 && stdout.includes("SACMS_BOOTSTRAP_OK")) {
                resolve()
              } else {
                reject(new Error(`Setup script keluar dengan kode ${code}: ${(stderr || stdout).slice(-2000)}`))
              }
            })
            .on("data", (d: Buffer) => { stdout += d.toString() })
          stream.stderr.on("data", (d: Buffer) => { stderr += d.toString() })
        })
      })
      .on("error", (err) => {
        clearTimeout(timeout)
        reject(err)
      })
      .connect({ host, port: 22, username, password, readyTimeout: 30_000, tryKeyboard: false })
  })
}

/**
 * SSHes into a freshly-active VPS (root/password from createVm — see
 * vps-fulfillment.ts) and installs PostgreSQL + MinIO as its sole purpose:
 * this account's/workspace's own dedicated database and S3-compatible
 * storage (BYODB/BYOS), fully automated. Unlike managed-infra.ts's
 * "Database & Storage Sendiri" add-on (SaCMS IT manually sets up a server
 * and connects it by hand), nothing here waits on a human.
 */
export async function provisionDbAndStorage(params: {
  host: string
  rootUser: string
  rootPassword: string
}): Promise<ProvisionedInfra> {
  const { host, rootUser, rootPassword } = params
  const dbPassword = genSecret()
  const minioAccessKey = genAccessKey()
  const minioSecretKey = genSecret()

  await execViaSsh(host, rootUser, rootPassword, buildBootstrapScript({ dbPassword, minioAccessKey, minioSecretKey }))

  return {
    databaseUrl: `postgresql://sacms_app:${dbPassword}@${host}:5432/sacms?sslmode=disable`,
    storageConfig: {
      endpoint: `http://${host}:9000`,
      accessKey: minioAccessKey,
      secretKey: minioSecretKey,
      bucket: "sacms",
      publicUrl: `http://${host}:9000/sacms`,
    },
  }
}

/**
 * Orchestrates the above for one VpsInstance and wires the result into
 * Tenant.databaseUrl/storageConfig (tenant-scoped instance) or
 * User.masterDatabaseUrl/masterStorageConfig (account-scoped instance).
 * Called fire-and-forget from the status-refresh routes the first time an
 * instance's IP becomes available — never awaited by that request, since
 * apt-get + MinIO setup can take a few minutes; the owner/tenant clicks
 * Refresh again later to see dbStorageStatus flip to "connected".
 *
 * Never clobbers an existing database/storage connection: if the
 * account/workspace already has one (e.g. an Enterprise dedicated DB, or a
 * manually-connected managed-infra service), this marks the instance
 * "skipped" and opens a support ticket instead of silently overwriting
 * something that might already be in production use.
 */
export async function provisionVpsDbAndStorageTask(instanceId: string): Promise<void> {
  const instance = await db.vpsInstance.findUnique({ where: { id: instanceId } })
  if (!instance || !instance.ipAddress || !instance.rootPassword || !instance.rootUser) return

  try {
    if (instance.tenantId) {
      const tenant = await db.tenant.findUnique({ where: { id: instance.tenantId }, select: { databaseUrl: true, storageConfig: true, name: true, slug: true } })
      if (tenant?.databaseUrl || tenant?.storageConfig) {
        await db.vpsInstance.update({ where: { id: instance.id }, data: { dbStorageStatus: "skipped", dbStorageError: "Workspace ini sudah memiliki koneksi database/storage sendiri." } })
        await openVpsSupportTicket(
          instance.ownerId, instance.tenantId, instance.orderId,
          `VPS sudah aktif (${instance.ipAddress}) tapi workspace "${tenant?.name ?? instance.tenantId}" sudah memiliki koneksi database/storage sendiri — tidak ditimpa otomatis. Hubungkan manual di Infrastructure jika memang ingin memindahkan ke VPS baru ini.`,
          `VPS siap tapi perlu keputusan manual — order ${instance.orderId}`,
        )
        return
      }

      const { databaseUrl, storageConfig } = await provisionDbAndStorage({ host: instance.ipAddress, rootUser: instance.rootUser, rootPassword: instance.rootPassword })
      await db.tenant.update({ where: { id: instance.tenantId }, data: { databaseUrl, storageConfig } })
    } else {
      const owner = await db.user.findUnique({ where: { id: instance.ownerId }, select: { masterDatabaseUrl: true, masterStorageConfig: true } })
      if (owner?.masterDatabaseUrl || owner?.masterStorageConfig) {
        await db.vpsInstance.update({ where: { id: instance.id }, data: { dbStorageStatus: "skipped", dbStorageError: "Akun ini sudah memiliki koneksi database/storage sendiri." } })
        await openVpsSupportTicket(
          instance.ownerId, null, instance.orderId,
          `VPS sudah aktif (${instance.ipAddress}) tapi akun ini sudah memiliki koneksi database/storage sendiri — tidak ditimpa otomatis. Hubungkan manual jika memang ingin memindahkan ke VPS baru ini.`,
          `VPS siap tapi perlu keputusan manual — order ${instance.orderId}`,
        )
        return
      }

      const { databaseUrl, storageConfig } = await provisionDbAndStorage({ host: instance.ipAddress, rootUser: instance.rootUser, rootPassword: instance.rootPassword })
      await db.user.update({ where: { id: instance.ownerId }, data: { masterDatabaseUrl: databaseUrl, masterStorageConfig: storageConfig } })
      const { invalidateOwnerMasterInfraCache } = await import("@/lib/database")
      await invalidateOwnerMasterInfraCache(instance.ownerId)
    }

    await db.vpsInstance.update({ where: { id: instance.id }, data: { dbStorageStatus: "connected", dbStorageConnectedAt: new Date() } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[VPS] DB/Storage bootstrap failed for instance ${instance.id}:`, err)
    await db.vpsInstance.update({ where: { id: instance.id }, data: { dbStorageStatus: "failed", dbStorageError: message } })
    await openVpsSupportTicket(
      instance.ownerId, instance.tenantId, instance.orderId,
      `Setup otomatis PostgreSQL + MinIO di VPS (${instance.ipAddress}) gagal: ${message}`,
    )
  }
}
