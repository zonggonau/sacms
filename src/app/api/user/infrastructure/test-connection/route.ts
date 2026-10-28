/**
 * POST /api/user/infrastructure/test-connection
 * Tests an arbitrary, not-yet-saved Postgres connection string or MinIO
 * config the caller just typed into the Infrastruktur page — never persists
 * anything. Gated the same way as PUT /api/user/infrastructure (Enterprise/
 * Agency only, see isOwnerEligibleForByoInfra): connecting to an arbitrary
 * user-supplied host:port is an SSRF-shaped surface, so this stays behind
 * the same plan gate rather than being open to every signed-up account.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient, isOwnerEligibleForByoInfra } from "@/lib/database"
import { apiError, readJson } from "@/lib/api/route-helpers"
import { MinioConfigSchema, isValidPostgresUrl } from "@/lib/byo-infra-validation"
import { createS3Client } from "@/lib/s3-client"
import { HeadBucketCommand } from "@aws-sdk/client-s3"
import { z } from "zod"

export const dynamic = "force-dynamic"

const TestSchema = z.union([
  z.object({ type: z.literal("database"), url: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("storage"), config: MinioConfigSchema }),
])

const TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), TIMEOUT_MS)),
  ])
}

/**
 * A throwaway PrismaClient otherwise opens its FULL default pool
 * (num_cpus*2+1 connections) just to run one SELECT 1 — harmless once, but
 * every "Tes Koneksi" click opens another full pool on top of whatever's
 * already open, and a small/local Postgres's max_connections exhausts fast
 * ("sorry, too many clients already"), taking down the MAIN app's own `db`
 * client along with it. Capping this one-off client to a single connection
 * (and a short connect timeout) keeps a test's footprint to ~1 connection,
 * released the moment $disconnect() runs below.
 */
function withPoolLimit(url: string): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}connection_limit=1&connect_timeout=5`
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  if (!(await isOwnerEligibleForByoInfra(session.user.id))) {
    return apiError("forbidden", { message: "Tes koneksi hanya tersedia untuk plan Enterprise atau Agency." })
  }

  const body = await readJson(request, TestSchema)
  if (!body.ok) return body.response

  if (body.data.type === "database") {
    if (!isValidPostgresUrl(body.data.url)) {
      return apiError("validation", { message: "URL database harus dimulai dengan postgres:// atau postgresql://" })
    }

    // A throwaway client, bypassing the tenant-connection-pool/cache
    // machinery entirely — this URL may never be saved.
    const client = new PrismaClient({ datasources: { db: { url: withPoolLimit(body.data.url) } } })
    try {
      await withTimeout(client.$queryRaw`SELECT 1`, "Koneksi database timeout (8 detik).")
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Gagal terhubung ke database.",
      })
    } finally {
      await client.$disconnect().catch(() => {})
    }

    return NextResponse.json({ success: true, message: "Koneksi database berhasil." })
  }

  const { endpoint, accessKey, secretKey, bucket } = body.data.config
  try {
    const s3 = createS3Client(endpoint, accessKey, secretKey)
    await withTimeout(s3.send(new HeadBucketCommand({ Bucket: bucket })), "Koneksi storage timeout (8 detik).")
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Gagal terhubung ke storage atau bucket tidak ditemukan.",
    })
  }

  return NextResponse.json({ success: true, message: "Koneksi storage berhasil, bucket ditemukan." })
}
