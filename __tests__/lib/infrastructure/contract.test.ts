import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import {
  CONTABO_PLANS,
  getContaboPlansList,
  buildSacmsDefaultFirewallRules,
  createContaboFirewall,
  listContaboFirewalls,
  getContaboFirewall,
  assignFirewallToInstance,
  removeFirewallFromInstance,
  deleteContaboFirewall,
  createContaboSnapshot,
  listContaboSnapshots,
  getContaboSnapshot,
  rollbackContaboSnapshot,
  deleteContaboSnapshot,
  createContaboInstance,
  getContaboInstance,
  restartContaboInstance,
  stopContaboInstance,
  deleteContaboInstance,
} from "@/lib/infrastructure/contabo"

describe("Contabo OpenAPI Contract Tests", () => {
  const originalEnv = { ...process.env }

  beforeAll(() => {
    process.env.CONTABO_CLIENT_ID = ""
    process.env.CONTABO_CLIENT_SECRET = ""
    process.env.CONTABO_API_USER = ""
    process.env.CONTABO_API_PASSWORD = ""
  })

  afterAll(() => {
    process.env.CONTABO_CLIENT_ID = originalEnv.CONTABO_CLIENT_ID
    process.env.CONTABO_CLIENT_SECRET = originalEnv.CONTABO_CLIENT_SECRET
    process.env.CONTABO_API_USER = originalEnv.CONTABO_API_USER
    process.env.CONTABO_API_PASSWORD = originalEnv.CONTABO_API_PASSWORD
  })
  describe("Compute & Plans Mapping", () => {
    it("should provide valid Cloud VPS, VPS Plus, VPS Storage and VDS tier definitions", () => {
      const plans = getContaboPlansList()
      expect(plans.length).toBeGreaterThanOrEqual(20)

      // 1. Cloud VPS (SSD)
      const vps4 = CONTABO_PLANS["vps-4"]
      expect(vps4.productId).toBe("V153")
      expect(vps4.cpuCores).toBe(4)
      expect(vps4.diskGb).toBe(100)

      // 2. Cloud VPS Plus (NVMe)
      const vpsPlus4 = CONTABO_PLANS["vps-plus-4"]
      expect(vpsPlus4.productId).toBe("V159")
      expect(vpsPlus4.cpuCores).toBe(4)
      expect(vpsPlus4.ramMb).toBe(8192)
      expect(vpsPlus4.diskType).toBe("NVMe")

      // 3. VPS Storage
      const vpsStorage10 = CONTABO_PLANS["vps-storage-10"]
      expect(vpsStorage10.productId).toBe("V93")
      expect(vpsStorage10.diskGb).toBe(300)

      // 4. Cloud VDS (Dedicated CPU)
      const vdsS = CONTABO_PLANS["vds-s"]
      expect(vdsS.productId).toBe("V8")
      expect(vdsS.cpuCores).toBe(3)
      expect(vdsS.ramMb).toBe(24576)
      expect(vdsS.isDedicatedCpu).toBe(true)
    })

    it("should handle instance lifecycle actions in simulation mode", async () => {
      const restarted = await restartContaboInstance("sim-12345")
      expect(restarted).toBe(true)

      const stopped = await stopContaboInstance("sim-12345")
      expect(stopped).toBe(true)

      const deleted = await deleteContaboInstance("sim-12345")
      expect(deleted).toBe(true)

      const details = await getContaboInstance("sim-12345")
      expect(details.instanceId).toBe("sim-12345")
      expect(details.status).toBe("ok")
      expect(details.ipv4).toBe("127.0.0.1")
    })
  })

  describe("Cloud Firewall Contract Schema", () => {
    it("should generate valid InboundRuleRequest schema for PostgreSQL and Caddy", () => {
      const rules = buildSacmsDefaultFirewallRules(["192.168.1.100"])
      expect(rules).toHaveLength(3)

      for (const rule of rules) {
        expect(["tcp", "udp", "icmp", ""]).toContain(rule.protocol)
        expect(Array.isArray(rule.destPorts)).toBe(true)
        expect(["accept", "drop"]).toContain(rule.action)
        expect(["active", "inactive"]).toContain(rule.status)
        expect(rule.srcCidr).toHaveProperty("ipv4")
      }
    })

    it("should handle firewall CRUD simulation endpoints", async () => {
      const fw = await createContaboFirewall({
        name: "contract-test-fw",
        rules: buildSacmsDefaultFirewallRules(),
      })
      expect(fw.firewallId).toMatch(/^sim-fw-/)
      expect(fw.name).toBe("contract-test-fw")

      const list = await listContaboFirewalls("contract-test-fw")
      expect(list.length).toBeGreaterThan(0)

      const single = await getContaboFirewall(fw.firewallId)
      expect(single.firewallId).toBe(fw.firewallId)

      const assigned = await assignFirewallToInstance(fw.firewallId, "sim-99")
      expect(assigned).toBe(true)

      const removed = await removeFirewallFromInstance(fw.firewallId, "sim-99")
      expect(removed).toBe(true)

      const deleted = await deleteContaboFirewall(fw.firewallId)
      expect(deleted).toBe(true)
    })
  })

  describe("Snapshots Contract Schema", () => {
    it("should handle snapshot creation, listing, rollback, and deletion", async () => {
      const snap = await createContaboSnapshot("sim-555", "Golden Image", "Initial provision golden image")
      expect(snap.snapshotId).toBeDefined()
      expect(snap.name).toBe("Golden Image")
      expect(snap.instanceId).toBe("sim-555")

      const list = await listContaboSnapshots("sim-555")
      expect(list.length).toBeGreaterThan(0)

      const fetched = await getContaboSnapshot("sim-555", snap.snapshotId)
      expect(fetched.snapshotId).toBe(snap.snapshotId)

      const rolledBack = await rollbackContaboSnapshot("sim-555", snap.snapshotId)
      expect(rolledBack).toBe(true)

      const deleted = await deleteContaboSnapshot("sim-555", snap.snapshotId)
      expect(deleted).toBe(true)
    })
  })
})
