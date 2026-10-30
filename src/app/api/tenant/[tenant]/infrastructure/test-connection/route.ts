import { NextResponse } from "next/server"
import { isWorkspaceEligibleForByoInfra } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { MinioConfigSchema, isValidPostgresUrl } from "@/lib/byo-infra-validation"
import { testDatabaseConnection, testStorageConnection } from "@/lib/byo-infra-test"
import { z } from "zod"

export const dynamic = "force-dynamic"

/**
 * POST /api/tenant/[tenant]/infrastructure/test-connection
 * Tests an arbitrary, not-yet-saved Postgres connection string or MinIO
 * config for THIS workspace's own direct database/storage override — never
 * persists anything. Gated by isWorkspaceEligibleForByoInfra (workspace
 * plan "business"/"enterprise", or the owner's Enterprise License), the
 * same SSRF-shaped-surface reasoning as the account-level equivalent at
 * /api/user/infrastructure/test-connection.
 */
const TestSchema = z.union([
  z.object({ type: z.literal("database"), url: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("storage"), config: MinioConfigSchema }),
])

export const POST = withStaffAuth(
  async (request, _context, { access }) => {
    if (!(await isWorkspaceEligibleForByoInfra(access.tenantId))) {
      return apiError("forbidden", { message: "Tes koneksi hanya tersedia untuk workspace plan Business atau lisensi Enterprise." })
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
  },
  { minRole: "owner" },
)
