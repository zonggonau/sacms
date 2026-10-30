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
import { isOwnerEligibleForByoInfra } from "@/lib/database"
import { apiError, readJson } from "@/lib/api/route-helpers"
import { MinioConfigSchema, isValidPostgresUrl } from "@/lib/byo-infra-validation"
import { testDatabaseConnection, testStorageConnection } from "@/lib/byo-infra-test"
import { z } from "zod"

export const dynamic = "force-dynamic"

const TestSchema = z.union([
  z.object({ type: z.literal("database"), url: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("storage"), config: MinioConfigSchema }),
])

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
    return NextResponse.json(await testDatabaseConnection(body.data.url))
  }

  return NextResponse.json(await testStorageConnection(body.data.config))
}
