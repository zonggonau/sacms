/**
 * PUT/DELETE /api/user/storage-allocations/[tenantId]
 * Owner-facing management of a single workspace's explicit slice of the
 * caller's pooled Enterprise storage grant. PUT sets/replaces an explicit
 * allocatedGb figure; DELETE hands the workspace back to the auto-split
 * pool (see getOwnerStorageAllocationPlan in plan-enforcement.ts — there is
 * no "0 GB" sentinel, only "row exists" vs "row doesn't exist").
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { apiError } from "@/lib/api/route-helpers"
import { getOwnerStorageLicense } from "@/lib/plan-enforcement"

export const dynamic = "force-dynamic"

const GB = 1024 * 1024 * 1024

async function requireOwnedTenant(userId: string, tenantId: string): Promise<boolean> {
  const member = await db.tenantMember.findFirst({ where: { tenantId, userId, role: "owner" } })
  return !!member
}

export async function PUT(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")
  const ownerId = session.user.id
  const { tenantId } = await context.params

  const ownerLicense = await getOwnerStorageLicense(ownerId)
  if (!ownerLicense.licensed) {
    return apiError("forbidden", { message: "Akun ini tidak memiliki lisensi Enterprise dengan kuota storage." })
  }

  if (!(await requireOwnedTenant(ownerId, tenantId))) {
    return apiError("forbidden", { message: "Anda bukan pemilik workspace ini." })
  }

  const body = await request.json().catch(() => null)
  const allocatedGb = Number(body?.allocatedGb)
  if (!Number.isInteger(allocatedGb) || allocatedGb <= 0) {
    return apiError("validation", { message: "allocatedGb harus berupa bilangan bulat lebih dari 0." })
  }

  // Sum invariant: this workspace's new explicit figure plus every OTHER
  // explicit figure must not exceed the pool. Checked live against the
  // license's current size, not a stored invariant — a later license
  // downgrade is allowed to put existing rows over this (see
  // getOwnerStorageAllocationPlan's clamp-at-0 remainder), it just blocks
  // this write from making an over-allocation worse.
  const otherExplicit = await db.enterpriseStorageAllocation.findMany({
    where: { ownerId, tenantId: { not: tenantId } },
    select: { allocatedGb: true },
  })
  const otherExplicitBytes = otherExplicit.reduce((sum, r) => sum + r.allocatedGb * GB, 0)
  const requestedBytes = allocatedGb * GB

  if (otherExplicitBytes + requestedBytes > ownerLicense.limitBytes) {
    const remainingGb = Math.max(0, Math.floor((ownerLicense.limitBytes - otherExplicitBytes) / GB))
    return apiError("validation", {
      message: `Alokasi ini melebihi sisa kuota lisensi. Sisa yang tersedia untuk workspace ini: ${remainingGb} GB.`,
    })
  }

  await db.enterpriseStorageAllocation.upsert({
    where: { tenantId },
    update: { allocatedGb, ownerId },
    create: { tenantId, ownerId, allocatedGb },
  })

  return NextResponse.json({ tenantId, allocatedGb, isExplicit: true })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")
  const ownerId = session.user.id
  const { tenantId } = await context.params

  if (!(await requireOwnedTenant(ownerId, tenantId))) {
    return apiError("forbidden", { message: "Anda bukan pemilik workspace ini." })
  }

  // Idempotent no-op if no explicit row exists — "already auto-split" is a
  // valid end state, not an error.
  await db.enterpriseStorageAllocation.deleteMany({ where: { tenantId, ownerId } })

  return NextResponse.json({ tenantId, isExplicit: false })
}
