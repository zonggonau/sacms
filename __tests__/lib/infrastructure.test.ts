import { describe, it, expect } from "vitest"
import { encryptCredential, decryptCredential, generateSecurePassword } from "@/lib/infrastructure/encryption"
import { generateCloudInitScript } from "@/lib/infrastructure/cloud-init"
import { isContaboConfigured, createContaboInstance } from "@/lib/infrastructure/contabo"
import { isCloudflareConfigured, createOrUpdateDnsRecord } from "@/lib/infrastructure/dns"

describe("Infrastructure Module Tests", () => {
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
      })

      expect(script).toContain("#cloud-config")
      expect(script).toContain("docker.io")
      expect(script).toContain("postgres:17-alpine")
      expect(script).toContain("minio/minio:latest")
      expect(script).toContain("caddy:2-alpine")
      expect(script).toContain("media-acme-corp.sacms.cloud")
      expect(script).toContain("sacms-media")
      expect(script).toContain("ufw allow 5432/tcp")
      expect(script).toContain("ufw allow 443/tcp")
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
