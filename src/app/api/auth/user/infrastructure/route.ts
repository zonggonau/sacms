import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { assertPublicHost, SsrfError } from "@/lib/safe-url"

const MASK = "••••••••"
const DB_URL_SCHEMES = ["postgres:", "postgresql:"]

// GET /api/auth/user/infrastructure - masked view of the current user's
// master DB/S3 override. Real secrets never leave the server here; use
// ?reveal=databaseUrl|s3SecretKey|s3AccessKey to fetch one real value on
// demand (rate-limited and audited under a dedicated action distinct from
// an ordinary settings write, so "who viewed this secret" is searchable on
// its own in the audit log).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Gated the same as PUT: a user downgraded off Enterprise can no longer
  // set these values, so they shouldn't be able to keep viewing/revealing
  // whatever was set while they still were.
  if (session.user.plan !== "enterprise") {
    return NextResponse.json({ error: "Forbidden: Enterprise plan required" }, { status: 403 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { masterDatabaseUrl: true, masterStorageConfig: true },
  })

  const storageConfig = (user?.masterStorageConfig as any) || {}
  const reveal = req.nextUrl.searchParams.get("reveal")

  if (reveal) {
    const rl = await rateLimit(`infra-reveal:${session.user.id}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return NextResponse.json({ error: "Too many reveal requests. Try again shortly." }, { status: 429 })
    }

    const REVEALABLE = ["databaseUrl", "s3AccessKey", "s3SecretKey"] as const
    if (!REVEALABLE.includes(reveal as any)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 })
    }
    const values: Record<string, string> = {
      databaseUrl: user?.masterDatabaseUrl || "",
      s3AccessKey: storageConfig.accessKeyId || "",
      s3SecretKey: storageConfig.secretAccessKey || "",
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
    databaseUrl: user?.masterDatabaseUrl ? MASK : "",
    s3Bucket: storageConfig.bucket || "",
    s3Region: storageConfig.region || "",
    s3AccessKey: storageConfig.accessKeyId ? MASK : "",
    s3SecretKey: storageConfig.secretAccessKey ? MASK : "",
  })
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Enterprise users can set master infrastructure
    if (session.user.plan !== "enterprise") {
      return NextResponse.json({ error: "Forbidden: Enterprise plan required" }, { status: 403 })
    }

    const data = await req.json()
    const { databaseUrl, s3Bucket, s3Region, s3AccessKey, s3SecretKey } = data

    const existing = await db.user.findUnique({
      where: { id: session.user.id },
      select: { masterDatabaseUrl: true, masterStorageConfig: true },
    })
    const existingStorage = (existing?.masterStorageConfig as any) || {}

    const nextDatabaseUrl = databaseUrl === MASK ? existing?.masterDatabaseUrl || "" : databaseUrl || ""
    const nextAccessKey = s3AccessKey === MASK ? existingStorage.accessKeyId || "" : s3AccessKey || ""
    const nextSecretKey = s3SecretKey === MASK ? existingStorage.secretAccessKey || "" : s3SecretKey || ""

    // This value is used to open a real server-side Postgres connection
    // for every tenant this user creates (see src/lib/database.ts's
    // acquireTenantClient via src/app/api/tenant/create/route.ts) — an
    // unvalidated host here is a direct SSRF into the production network.
    if (nextDatabaseUrl) {
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
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        masterDatabaseUrl: nextDatabaseUrl,
        masterStorageConfig: {
          bucket: s3Bucket || "",
          region: s3Region || "",
          accessKeyId: nextAccessKey,
          secretAccessKey: nextSecretKey,
        },
      },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserMasterInfra",
      data: {
        databaseHostChanged: (existing?.masterDatabaseUrl || "") !== nextDatabaseUrl,
        bucket: s3Bucket || "",
        region: s3Region || "",
        accessKeyChanged: (existingStorage.accessKeyId || "") !== nextAccessKey,
        secretKeyChanged: (existingStorage.secretAccessKey || "") !== nextSecretKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update user infrastructure:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
