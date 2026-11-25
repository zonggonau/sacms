import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, settings } = vi.hoisted(() => ({
  db: { user: { findFirst: vi.fn() } },
  settings: { registrationMode: "open" as "open" | "invite_only" | "closed" },
}))
vi.mock("@/lib/database", () => ({ db }))
vi.mock("@/lib/settings", () => ({ getPlatformSettings: vi.fn(async () => settings) }))

import { registrationBlockReason, REGISTRATION_CLOSED_MESSAGE, REGISTRATION_INVITE_ONLY_MESSAGE } from "@/lib/registration-policy"

describe("registrationBlockReason", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // First lookup: does a super admin exist? Second (invite_only): is the email invited?
    db.user.findFirst.mockResolvedValue({ id: "admin" })
  })

  it("allows everyone when registration is open", async () => {
    settings.registrationMode = "open"
    expect(await registrationBlockReason("x@example.test")).toBeNull()
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it("blocks every new account when registration is closed", async () => {
    settings.registrationMode = "closed"
    expect(await registrationBlockReason("x@example.test")).toBe(REGISTRATION_CLOSED_MESSAGE)
  })

  it("still lets a fresh install create its first super admin", async () => {
    settings.registrationMode = "closed"
    db.user.findFirst.mockResolvedValueOnce(null)
    expect(await registrationBlockReason("owner@example.test")).toBeNull()
  })

  it("invite_only: allows an email a workspace admin already added, blocks anyone else", async () => {
    settings.registrationMode = "invite_only"
    db.user.findFirst.mockResolvedValueOnce({ id: "admin" }).mockResolvedValueOnce({ id: "invited" })
    expect(await registrationBlockReason("Invited@Example.test")).toBeNull()
    expect(db.user.findFirst).toHaveBeenLastCalledWith({
      where: { email: { equals: "Invited@Example.test", mode: "insensitive" }, tenants: { some: {} } },
      select: { id: true },
    })

    db.user.findFirst.mockResolvedValueOnce({ id: "admin" }).mockResolvedValueOnce(null)
    expect(await registrationBlockReason("stranger@example.test")).toBe(REGISTRATION_INVITE_ONLY_MESSAGE)
  })
})
