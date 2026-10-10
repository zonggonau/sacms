import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { withStaffAuth } from "@/lib/api/route-helpers"

/**
 * GET /api/tenant/[tenant]/api-keys — list workspace API keys (admin/owner).
 * `key` stores a SHA-256 hash now (see scripts/migrate/backfill-apikey-hash.ts
 * for the one-time re-hash of pre-existing plaintext rows) — there is no
 * raw value to reveal anymore, for anyone, regardless of role. Rotate via
 * POST to get a fresh value, shown exactly once in that response.
 */
export const GET = withStaffAuth(
  async (_request, _context, { access }) => {
    const keys = await db.apiKey.findMany({
      where: { tenantId: access.tenantId },
      select: { id: true, name: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        expiresAt: k.expiresAt,
      })),
    })
  },
  { minRole: "admin" },
)

/**
 * POST /api/tenant/[tenant]/api-keys — rotate the workspace API key (admin/owner).
 * A workspace keeps a single key: the first row is updated, any extras are
 * removed. Only the hash is persisted; the plain value is returned once,
 * here, and never stored or retrievable again.
 */
export const POST = withStaffAuth(
  async (_request, _context, { access }) => {
    const newApiKey = `sacms_${randomBytes(24).toString("hex")}`
    const hashedKey = createHash("sha256").update(newApiKey).digest("hex")
    const label = `API Key (${new Date().toLocaleDateString()})`

    const existingKeys = await db.apiKey.findMany({ where: { tenantId: access.tenantId } })

    if (existingKeys.length > 0) {
      const [firstKey, ...restKeys] = existingKeys
      await db.apiKey.update({
        where: { id: firstKey.id },
        data: { key: hashedKey, name: label },
      })
      if (restKeys.length > 0) {
        await db.apiKey.deleteMany({ where: { id: { in: restKeys.map((k) => k.id) } } })
      }
    } else {
      await db.apiKey.create({
        data: {
          tenantId: access.tenantId,
          name: label,
          key: hashedKey,
          permissions: { fullAccess: true },
        },
      })
    }

    return NextResponse.json({ apiKey: newApiKey }, { status: 201 })
  },
  { minRole: "admin" },
)

/**
 * DELETE /api/tenant/[tenant]/api-keys?id=<id> — revoke a legacy workspace
 * API key (admin/owner). This is the only credential type this route ever
 * mints and manages; there is no create-new-legacy-key path exposed in the
 * UI — only revoke — since the ApiToken model is the current, correctly
 * scoped credential type. This exists purely so an already-issued legacy
 * key can be turned off without DB access.
 */
export const DELETE = withStaffAuth(
  async (request, _context, { access }) => {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const existing = await db.apiKey.findFirst({ where: { id, tenantId: access.tenantId } })
    if (!existing) return NextResponse.json({ error: "API key not found" }, { status: 404 })

    await db.apiKey.delete({ where: { id } })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
