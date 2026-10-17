import { NextResponse } from "next/server"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { finalizeSchema, unlockSchemaToDraft, isSchemaFinalized } from "@/lib/schema-lock"

/** Toggles the tenant's schema between draft (editable) and final (locked, required before AI Site can generate). */
export const PATCH = withStaffAuth(
  async (req, _context, { access }) => {
    const { finalized } = await req.json().catch(() => ({}))
    if (typeof finalized !== "boolean") {
      return apiError("validation", { message: "finalized must be true or false" })
    }

    if (finalized) {
      await finalizeSchema(access.tenantId)
    } else {
      await unlockSchemaToDraft(access.tenantId)
    }

    return NextResponse.json({ finalized })
  },
  { minRole: "admin" },
)

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  return NextResponse.json({ finalized: await isSchemaFinalized(access.tenantId) })
}, { minRole: "editor" })
