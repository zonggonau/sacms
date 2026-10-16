import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db, PrismaClient, invalidateOwnerMasterInfraCache } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { assertPublicHost, assertPublicUrl, SsrfError } from "@/lib/safe-url"

const MASK = "••••••••"
const DB_URL_SCHEMES = ["postgres:", "postgresql:"]

async function hasAccountLicense(userId: string, plan: string | undefined): Promise<boolean> {
  if (plan === "enterprise") return true
  const globalId = await getGlobalWorkspaceId()
  return isEnterpriseTenant(globalId, userId)
}

// GET /api/auth/user/infrastructure - masked view of the current user's
// master DB/storage override, applied to every workspace this user owns
// that has no override of its own — see getOwnerMasterInfra() in
// src/lib/database.ts. Real secrets never leave the server here; use
// ?reveal=databaseUrl|accessKey|secretKey to fetch one real value on demand
// (rate-limited and audited under a dedicated action).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, masterDatabaseUrl: true, masterStorageConfig: true },
  })
  const allowed = await hasAccountLicense(session.user.id, user?.plan)

  const storageConfig = (user?.masterStorageConfig as any) || {}
  const reveal = req.nextUrl.searchParams.get("reveal")

  if (reveal) {
    if (!allowed) return NextResponse.json({ error: "Forbidden: requires an Enterprise License" }, { status: 403 })
    const rl = await rateLimit(`infra-reveal:${session.user.id}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return NextResponse.json({ error: "Too many reveal requests. Try again shortly." }, { status: 429 })
    }

    const REVEALABLE = ["databaseUrl", "accessKey", "secretKey"] as const
    if (!REVEALABLE.includes(reveal as any)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 })
    }
    const values: Record<string, string> = {
      databaseUrl: user?.masterDatabaseUrl || "",
      accessKey: storageConfig.accessKey || "",
      secretKey: storageConfig.secretKey || "",
    }
    logAudit({
      userId: session.user.id,
      action: AuditAction.SECRET_REVEALED,
      entity: "UserMasterInfra",
      data: { field: reveal },
    })
    return NextResponse.json({ field: reveal, value: values[reveal] })
  }

  return NextResponse.json({
    hasLicense: allowed,
    databaseUrl: user?.masterDatabaseUrl ? MASK : "",
    endpoint: storageConfig.endpoint || "",
    bucket: storageConfig.bucket || "",
    publicUrl: storageConfig.publicUrl || "",
    accessKey: storageConfig.accessKey ? MASK : "",
    secretKey: storageConfig.secretKey ? MASK : "",
  })
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existingUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, masterDatabaseUrl: true, masterStorageConfig: true },
    })
    if (!(await hasAccountLicense(session.user.id, existingUser?.plan))) {
      return NextResponse.json({ error: "Forbidden: requires an Enterprise License" }, { status: 403 })
    }

    const data = await req.json()
    const { databaseUrl, endpoint, bucket, accessKey, secretKey, publicUrl } = data
    const existingStorage = (existingUser?.masterStorageConfig as any) || {}

    const nextDatabaseUrl = databaseUrl === MASK ? existingUser?.masterDatabaseUrl || "" : databaseUrl || ""
    const nextEndpoint = endpoint || ""
    const nextBucket = bucket || ""
    const nextAccessKey = accessKey === MASK ? existingStorage.accessKey || "" : accessKey || ""
    const nextSecretKey = secretKey === MASK ? existingStorage.secretKey || "" : secretKey || ""
    const nextPublicUrl = publicUrl || ""

    const dbUrlChanged = nextDatabaseUrl !== (existingUser?.masterDatabaseUrl || "")
    const hasStorage = Boolean(nextEndpoint && nextAccessKey && nextSecretKey && nextBucket)
    const storageChanged =
      nextEndpoint !== (existingStorage.endpoint || "") ||
      nextBucket !== (existingStorage.bucket || "") ||
      nextAccessKey !== (existingStorage.accessKey || "") ||
      nextSecretKey !== (existingStorage.secretKey || "") ||
      nextPublicUrl !== (existingStorage.publicUrl || "")

    // This value is used to open a real server-side Postgres connection for
    // every workspace this user owns that has no override of its own (see
    // getOwnerMasterInfra() in src/lib/database.ts) — an unvalidated host
    // here is a direct SSRF into the production network, and a typo would
    // silently break every one of this owner's workspaces at once.
    if (dbUrlChanged && nextDatabaseUrl) {
      let parsedDbUrl: URL
      try {
        parsedDbUrl = new URL(nextDatabaseUrl)
      } catch {
        return NextResponse.json({ error: "Invalid database URL" }, { status: 400 })
      }
      if (!DB_URL_SCHEMES.includes(parsedDbUrl.protocol)) {
        return NextResponse.json({ error: "Database URL must use the postgres:// or postgresql:// scheme" }, { status: 400 })
      }
      try {
        await assertPublicHost(parsedDbUrl.hostname)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof SsrfError ? `Database URL rejected: ${e.message}` : "Invalid database URL" },
          { status: 400 },
        )
      }
      const testClient = new PrismaClient({ datasources: { db: { url: nextDatabaseUrl } } })
      try {
        await testClient.$queryRaw`SELECT 1`
      } catch {
        return NextResponse.json(
          { error: "Gagal terhubung ke database yang Anda masukkan. Periksa kembali connection string (host, port, username, password, nama database)." },
          { status: 400 },
        )
      } finally {
        await testClient.$disconnect().catch(() => {})
      }
    }

    if (storageChanged && hasStorage) {
      try {
        await assertPublicUrl(nextEndpoint)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof SsrfError ? `Storage endpoint rejected: ${e.message}` : "Invalid storage endpoint" },
          { status: 400 },
        )
      }
      try {
        const { createS3Client } = await import("@/lib/s3-client")
        const { HeadBucketCommand } = await import("@aws-sdk/client-s3")
        const s3 = createS3Client(nextEndpoint, nextAccessKey, nextSecretKey)
        await s3.send(new HeadBucketCommand({ Bucket: nextBucket }))
      } catch {
        return NextResponse.json(
          { error: "Gagal terhubung ke storage (MinIO/S3) yang Anda masukkan. Periksa kembali endpoint, access key, secret key, dan nama bucket." },
          { status: 400 },
        )
      }
    } else if (storageChanged && (nextEndpoint || nextAccessKey || nextSecretKey || nextBucket)) {
      return NextResponse.json(
        { error: "Lengkapi semua field storage (endpoint, access key, secret key, bucket) sebelum menyimpan, atau kosongkan semuanya." },
        { status: 400 },
      )
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        masterDatabaseUrl: nextDatabaseUrl,
        masterStorageConfig: hasStorage
          ? { endpoint: nextEndpoint, accessKey: nextAccessKey, secretKey: nextSecretKey, bucket: nextBucket, publicUrl: nextPublicUrl }
          : {},
      },
    })

    await invalidateOwnerMasterInfraCache(session.user.id)

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserMasterInfra",
      data: {
        databaseHostChanged: dbUrlChanged,
        storageChanged,
        bucket: nextBucket,
        endpoint: nextEndpoint,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update user infrastructure:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
