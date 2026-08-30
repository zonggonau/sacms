import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { encryptCredential, decryptCredential, generateSecurePassword } from "@/lib/infrastructure/encryption"
import { generateCloudInitScript } from "@/lib/infrastructure/cloud-init"
import {
  isContaboConfigured,
  createContaboInstance,
  buildSacmsDefaultFirewallRules,
  createContaboFirewall,
  listContaboFirewalls,
  getContaboFirewall,
  assignFirewallToInstance,
  removeFirewallFromInstance,
  deleteContaboFirewall,
  findOrCreateSacmsFirewall,
  createContaboSnapshot,
  listContaboSnapshots,
  getContaboSnapshot,
  rollbackContaboSnapshot,
  deleteContaboSnapshot,
} from "@/lib/infrastructure/contabo"
import { isCloudflareConfigured, createOrUpdateDnsRecord } from "@/lib/infrastructure/dns"
import { provisionTenantInfrastructure } from "@/lib/infrastructure/provisioner"
import { db } from "@/lib/database"

describe("Infrastructure Module Tests", () => {
  const originalEnv = { ...process.env }

  beforeAll(() => {
    process.env.CONTABO_CLIENT_ID = ""
    process.env.CONTABO_CLIENT_SECRET = ""
    process.env.CONTABO_API_USER = ""
    process.env.CONTABO_API_PASSWORD = ""
    process.env.CLOUDFLARE_API_TOKEN = ""
  })

  afterAll(() => {
    process.env.CONTABO_CLIENT_ID = originalEnv.CONTABO_CLIENT_ID
    process.env.CONTABO_CLIENT_SECRET = originalEnv.CONTABO_CLIENT_SECRET
    process.env.CONTABO_API_USER = originalEnv.CONTABO_API_USER
    process.env.CONTABO_API_PASSWORD = originalEnv.CONTABO_API_PASSWORD
    process.env.CLOUDFLARE_API_TOKEN = originalEnv.CLOUDFLARE_API_TOKEN
  })
  describe("Encryption & Secret Management", () => {
    it("should encrypt and decrypt a connection string accurately", () => {
      const originalString = "postgresql://sacms_user:SecretP@ss123!@db-acme.sacms.cloud:5432/sacms_db?sslmode=require"
      const encrypted = encryptCredential(originalString)

      expect(encrypted).not.toBe(originalString)
      expect(encrypted.split(":")).toHaveLength(3)

      const decrypted = decryptCredential(encrypted)
      expect(decrypted).toBe(originalString)
    })

    it("should generate high-entropy passwords of requested length", () => {
      const pass24 = generateSecurePassword(24)
      const pass32 = generateSecurePassword(32)

      expect(pass24).toHaveLength(24)
      expect(pass32).toHaveLength(32)
      expect(pass24).not.toBe(pass32)
    })

    it("should throw an error when tampering with encrypted payload", () => {
      const encrypted = encryptCredential("hello-world")
      const tampered = encrypted.substring(0, encrypted.length - 4) + "ffff"
      expect(() => decryptCredential(tampered)).toThrow()
    })
  })

  describe("Cloud-Init Script Generation", () => {
    it("should generate a valid #cloud-config with PostgreSQL 17, MinIO S3 and Caddy", () => {
      const script = generateCloudInitScript({
        tenantSlug: "acme-corp",
        dbName: "sacms_db",
        dbUser: "sacms_user",
        dbPassword: "random_password_123",
        minioUser: "sacms_storage",
        minioPassword: "random_storage_pass_123",
        minioBucket: "sacms-media",
        dbDomain: "db-acme-corp.sacms.cloud",
        mediaDomain: "media-acme-corp.sacms.cloud",
        allowedManagementIps: ["103.145.22.5"],
      })

      expect(script).toContain("#cloud-config")
      expect(script).toContain("docker.io")
      expect(script).toContain("postgres:17-alpine")
      expect(script).toContain("minio/minio:latest")
      expect(script).toContain("caddy:2-alpine")
      expect(script).toContain("media-acme-corp.sacms.cloud")
      expect(script).toContain("sacms-media")
      expect(script).toContain("ufw allow from 103.145.22.5 to any port 5432 proto tcp")
      expect(script).toContain("ufw allow 443/tcp")
    })
  })

  describe("Contabo Cloud Firewall API & Rules", () => {
    it("should build hardened SaCMS default firewall rules matching openapi.json schema", () => {
      const rules = buildSacmsDefaultFirewallRules(["103.145.22.5"])

      expect(rules).toHaveLength(3)

      // Rule 1: PostgreSQL 5432
      const pgRule = rules.find(r => r.destPorts.includes("5432"))
      expect(pgRule).toBeDefined()
      expect(pgRule?.protocol).toBe("tcp")
      expect(pgRule?.action).toBe("accept")
      expect(pgRule?.srcCidr.ipv4).toContain("103.145.22.5/32")

      // Rule 2: Web & Media CDN 80 & 443
      const webRule = rules.find(r => r.destPorts.includes("443"))
      expect(webRule).toBeDefined()
      expect(webRule?.destPorts).toContain("80")
      expect(webRule?.srcCidr.ipv4).toContain("AnyIPv4")
      expect(webRule?.srcCidr.ipv6).toContain("AnyIPv6")

      // Rule 3: SSH 22
      const sshRule = rules.find(r => r.destPorts.includes("22"))
      expect(sshRule).toBeDefined()
      expect(sshRule?.srcCidr.ipv4).toContain("103.145.22.5/32")
    })

    it("should create a firewall in simulation mode when credentials not configured", async () => {
      const rules = buildSacmsDefaultFirewallRules()
      const fw = await createContaboFirewall({
        name: "test-firewall",
        description: "Test Firewall",
        rules,
      })

      expect(fw).toBeDefined()
      expect(fw.firewallId).toMatch(/^sim-fw-/)
      expect(fw.name).toBe("test-firewall")
      expect(fw.status).toBe("active")
    })

    it("should list, get, assign and remove firewall cleanly in simulation mode", async () => {
      const list = await listContaboFirewalls("sacms-enterprise-firewall")
      expect(list).toBeInstanceOf(Array)
      expect(list.length).toBeGreaterThan(0)

      const details = await getContaboFirewall("sim-fw-12345")
      expect(details.firewallId).toBe("sim-fw-12345")

      const assignOk = await assignFirewallToInstance("sim-fw-12345", "sim-999")
      expect(assignOk).toBe(true)

      const removeOk = await removeFirewallFromInstance("sim-fw-12345", "sim-999")
      expect(removeOk).toBe(true)

      const deleteOk = await deleteContaboFirewall("sim-fw-12345")
      expect(deleteOk).toBe(true)
    })

    it("should automatically find or create SaCMS firewall", async () => {
      const firewallId = await findOrCreateSacmsFirewall("sacms-enterprise-firewall", ["103.145.22.5"])
      expect(firewallId).toBeDefined()
      expect(typeof firewallId).toBe("string")
    })
  })

  describe("Contabo Snapshots & Disaster Recovery API", () => {
    it("should create, list, inspect, rollback, and delete snapshot in simulation mode", async () => {
      const snap = await createContaboSnapshot("sim-100", "Weekly Backup", "Automated weekly snapshot")
      expect(snap).toBeDefined()
      expect(snap.snapshotId).toMatch(/^snap-/)
      expect(snap.name).toBe("Weekly Backup")

      const list = await listContaboSnapshots("sim-100")
      expect(list).toBeInstanceOf(Array)
      expect(list.length).toBeGreaterThan(0)

      const fetched = await getContaboSnapshot("sim-100", snap.snapshotId)
      expect(fetched.snapshotId).toBe(snap.snapshotId)

      const rollbackOk = await rollbackContaboSnapshot("sim-100", snap.snapshotId)
      expect(rollbackOk).toBe(true)

      const deleteOk = await deleteContaboSnapshot("sim-100", snap.snapshotId)
      expect(deleteOk).toBe(true)
    })
  })

  describe("Async State Machine & Provisioner Flow", () => {
    it("should initiate provisioning without prematurely activating tenant databaseUrl", async () => {
      const tenant = await db.tenant.findFirst()
      if (!tenant) return

      const result = await provisionTenantInfrastructure(tenant.id, {
        plan: "vps-s",
        region: "SIN",
        autoActivateAsync: false,
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe("configuring")
      expect(result.serverId).toBeDefined()

      const server = await db.infrastructureServer.findUnique({
        where: { id: result.serverId },
      })
      expect(server).toBeDefined()
      expect(server?.status).toBe("configuring")

      const updatedTenant = await db.tenant.findUnique({
        where: { id: tenant.id },
      })
      expect(updatedTenant?.databaseUrl).toBe(tenant.databaseUrl)
    })
  })

  describe("Simulation Fallback Handling", () => {
    it("should safely handle unconfigured Contabo API without crashing", async () => {
      const instance = await createContaboInstance({
        displayName: "test-tenant",
        userData: "mock-user-data",
      })

      expect(instance).toBeDefined()
      expect(instance.cpuCores).toBe(4)
      expect(instance.ramMb).toBe(8192)
      expect(instance.ipv4).toBeDefined()
    })

    it("should safely handle unconfigured Cloudflare DNS without crashing", async () => {
      const dns = await createOrUpdateDnsRecord("db-test.sacms.cloud", "161.97.100.1")
      expect(dns).toBeDefined()
      expect(dns.name).toBe("db-test.sacms.cloud")
      expect(dns.content).toBe("161.97.100.1")
    })
  })
})
