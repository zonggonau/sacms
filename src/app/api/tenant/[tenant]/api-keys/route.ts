import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { withStaffAuth } from "@/lib/api/route-helpers"

/**
 * GET /api/tenant/[tenant]/api-keys — list workspace API keys (admin/owner).
 * The owner sees the full key (it's a single retrievable workspace key);
 * a plain admin sees only a masked preview. Rotate via POST to get a fresh
 * full value.
 */
export const GET = withStaffAuth(
  async (_request, _context, { access, session }) => {
    const canSeeFull = access.role === "owner" || session.user.role === "super_admin"
    const keys = await db.apiKey.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key: canSeeFull ? k.key : `${k.key.slice(0, 10)}…${k.key.slice(-4)}`,
        createdAt: k.createdAt,
      })),
    })
  },
  { minRole: "admin" },
)

/**
 * POST /api/tenant/[tenant]/api-keys — rotate the workspace API key (admin/owner).
 * A workspace keeps a single key: the first row is updated, any extras are removed.
 */
export const POST = withStaffAuth(
  async (_request, _context, { access }) => {
    const newApiKey = `sacms_${randomBytes(24).toString("hex")}`
    const label = `API Key (${new Date().toLocaleDateString()})`

    const existingKeys = await db.apiKey.findMany({ where: { tenantId: access.tenantId } })

    let apiKeyRecord
    if (existingKeys.length > 0) {
      const [firstKey, ...restKeys] = existingKeys
      apiKeyRecord = await db.apiKey.update({
        where: { id: firstKey.id },
        data: { key: newApiKey, name: label },
      })
      if (restKeys.length > 0) {
        await db.apiKey.deleteMany({ where: { id: { in: restKeys.map((k) => k.id) } } })
      }
    } else {
      apiKeyRecord = await db.apiKey.create({
        data: {
          tenantId: access.tenantId,
          name: label,
          key: newApiKey,
          permissions: { fullAccess: true },
        },
      })
    }

    return NextResponse.json({ apiKey: apiKeyRecord.key }, { status: 201 })
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
