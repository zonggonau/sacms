import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdminAuth, apiError, readJson, handleRouteError } from "@/lib/api/route-helpers"
import { biznetGio, BiznetGioError } from "@/lib/biznetgio"
import { logAudit, AuditAction } from "@/lib/audit-log"

// GET /api/admin/biznet-gio/vms — list VMs on SaCMS's Biznet Gio account
// (read-only, no cost).
export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.getAll("status")
  try {
    const accounts = await biznetGio.listAccounts(status.length ? status : undefined)
    return NextResponse.json({ accounts })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/vms", method: "GET" })
  }
})

const CreateVmSchema = z.object({
  product_id: z.number().int().positive(),
  cycle: z.enum(["m", "a", "q", "s", "b", "t", "p4", "p5"]),
  select_os: z.string().min(1),
  keypair_id: z.number().int().positive(),
  vm_name: z.string().min(6).max(16).regex(/^[a-zA-Z0-9.-]+$/).optional(),
  description: z.string().max(500).optional(),
  ssh_and_console_user: z.string().min(6).max(32).regex(/^[a-zA-Z0-9.-]+$/),
  console_password: z.string().min(8),
  promocode: z.string().optional(),
  // Required, not optional: this is the one field standing between a
  // malformed request and a real charge on SaCMS's own Biznet Gio account —
  // the caller must say so explicitly rather than relying on a default.
  confirmBilling: z.literal(true, {
    message: "confirmBilling must be true — this creates a real VM billed to SaCMS's own Biznet Gio account",
  }),
})

// POST /api/admin/biznet-gio/vms — provision a new VM. Creates a REAL
// instance billed to SaCMS's own Biznet Gio account (BIZNETGEO_TOKEN) —
// use only as part of the staff-assisted setup flow for an Enterprise
// License customer, never exposed to a customer-facing route.
export const POST = withAdminAuth(async (request, _context, { session }) => {
  const body = await readJson(request, CreateVmSchema)
  if (!body.ok) return body.response
  const { confirmBilling, ...payload } = body.data

  try {
    const result = await biznetGio.createVm({ ...payload, pay_invoice_with_cc: "no" })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "BiznetGioVmProvisioned",
      data: { product_id: payload.product_id, select_os: payload.select_os, vm_name: payload.vm_name },
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return apiError("validation", { message: error.message, details: error.body as Record<string, unknown> })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/vms", method: "POST" })
  }
})
