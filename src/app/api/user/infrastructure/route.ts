/**
 * GET/PUT /api/user/infrastructure
 * The caller's own "bring your own infrastructure" settings — a Postgres
 * connection string (BYODB) and/or MinIO/S3-compatible storage credentials
 * (BYOS), consulted by getOwnerMasterInfra() for every workspace the caller
 * owns (see src/lib/database.ts). Restricted to Enterprise/Agency plan
 * owners (see isOwnerEligibleForByoInfra) — a non-eligible owner may still
 * GET (to see/clear a stale value from a past downgrade) and clear an
 * existing value to null, just not set a new one.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, invalidateOwnerMasterInfraCache, isOwnerEligibleForByoInfra } from "@/lib/database"
import { apiError, readJson } from "@/lib/api/route-helpers"
import { MinioConfigSchema, isValidPostgresUrl, type MinioConfigInput } from "@/lib/byo-infra-validation"
import { Prisma } from "@prisma/client"
import { z } from "zod"

export const dynamic = "force-dynamic"

/** Sentinel the client sees in place of a real secret that IS set — same
 *  technique as src/lib/settings-secrets.ts, inlined here since that module
 *  is typed specifically to PlatformSettings. */
const MASK = "••••••••"

type MinioConfig = MinioConfigInput

const PutSchema = z.object({
  masterDatabaseUrl: z.string().max(2000).nullable().optional(),
  masterStorageConfig: MinioConfigSchema.nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { masterDatabaseUrl: true, masterStorageConfig: true },
  })

  const sc = (user?.masterStorageConfig as Partial<MinioConfig> | null) || null

  return NextResponse.json({
    eligible: await isOwnerEligibleForByoInfra(session.user.id),
    masterDatabaseUrl: user?.masterDatabaseUrl ? MASK : "",
    masterStorageConfig: sc
      ? {
          endpoint: sc.endpoint || "",
          accessKey: sc.accessKey || "",
          secretKey: sc.secretKey ? MASK : "",
          bucket: sc.bucket || "",
        }
      : null,
  })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const body = await readJson(request, PutSchema)
  if (!body.ok) return body.response
  const { masterDatabaseUrl, masterStorageConfig } = body.data

  // Clearing a stale value (from a past downgrade) is always allowed;
  // setting a NEW value requires Enterprise/Agency.
  const isSettingNewValue =
    (masterDatabaseUrl !== undefined && masterDatabaseUrl !== null && masterDatabaseUrl !== "") ||
    (masterStorageConfig !== undefined && masterStorageConfig !== null)
  if (isSettingNewValue && !(await isOwnerEligibleForByoInfra(session.user.id))) {
    return apiError("forbidden", { message: "Database/storage sendiri hanya tersedia untuk plan Enterprise atau Agency." })
  }

  const data: {
    masterDatabaseUrl?: string | null
    masterStorageConfig?: Prisma.InputJsonValue | typeof Prisma.JsonNull
  } = {}

  if (masterDatabaseUrl !== undefined) {
    if (masterDatabaseUrl === null || masterDatabaseUrl === "") {
      data.masterDatabaseUrl = null
    } else if (masterDatabaseUrl !== MASK) {
      if (!isValidPostgresUrl(masterDatabaseUrl)) {
        return apiError("validation", { message: "URL database harus dimulai dengan postgres:// atau postgresql://" })
      }
      data.masterDatabaseUrl = masterDatabaseUrl
    }
    // Echoed back unchanged (MASK) — leave the stored value alone.
  }

  if (masterStorageConfig !== undefined) {
    if (masterStorageConfig === null) {
      data.masterStorageConfig = Prisma.JsonNull
    } else {
      let secretKey = masterStorageConfig.secretKey
      if (secretKey === MASK) {
        const existing = await db.user.findUnique({ where: { id: session.user.id }, select: { masterStorageConfig: true } })
        const existingSc = existing?.masterStorageConfig as Partial<MinioConfig> | null
        if (!existingSc?.secretKey) {
          return apiError("validation", { message: "Secret Key MinIO wajib diisi." })
        }
        secretKey = existingSc.secretKey
      }
      data.masterStorageConfig = { ...masterStorageConfig, secretKey }
    }
  }

  if (Object.keys(data).length === 0) {
    return apiError("validation", { message: "Tidak ada perubahan yang dikirim." })
  }

  await db.user.update({ where: { id: session.user.id }, data })
  await invalidateOwnerMasterInfraCache(session.user.id)

  return NextResponse.json({ success: true })
}
