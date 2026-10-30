/**
 * Shared connection-testing mechanics for BYODB/BYOS — used by both the
 * account-level (/api/user/infrastructure/test-connection) and per-tenant
 * (/api/tenant/[tenant]/infrastructure/test-connection) routes, so the
 * connection-pool-exhaustion fix and timeout behavior only live in one
 * place. Callers keep their own auth/eligibility checks — this file is
 * pure connection-testing mechanics, no auth.
 */
import { PrismaClient } from "@/lib/database"
import { createS3Client } from "@/lib/s3-client"
import { HeadBucketCommand } from "@aws-sdk/client-s3"
import type { MinioConfigInput } from "@/lib/byo-infra-validation"

const TIMEOUT_MS = 8000

export function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
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
export function withPoolLimit(url: string): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}connection_limit=1&connect_timeout=5`
}

export async function testDatabaseConnection(url: string): Promise<{ success: boolean; message: string }> {
  // A throwaway client, bypassing the tenant-connection-pool/cache
  // machinery entirely — this URL may never be saved.
  const client = new PrismaClient({ datasources: { db: { url: withPoolLimit(url) } } })
  try {
    await withTimeout(client.$queryRaw`SELECT 1`, "Koneksi database timeout (8 detik).")
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal terhubung ke database." }
  } finally {
    await client.$disconnect().catch(() => {})
  }
  return { success: true, message: "Koneksi database berhasil." }
}

export async function testStorageConnection(config: MinioConfigInput): Promise<{ success: boolean; message: string }> {
  const { endpoint, accessKey, secretKey, bucket } = config
  try {
    const s3 = createS3Client(endpoint, accessKey, secretKey)
    await withTimeout(s3.send(new HeadBucketCommand({ Bucket: bucket })), "Koneksi storage timeout (8 detik).")
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal terhubung ke storage atau bucket tidak ditemukan.",
    }
  }
  return { success: true, message: "Koneksi storage berhasil, bucket ditemukan." }
}
