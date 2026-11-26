import { activeSchema } from "./site-schema-contract"
import { checkFrontendSource, type CheckFile, type FrontendWarning } from "./frontend-content-check"

/**
 * Runs the source checks against this workspace's active schema. Never throws:
 * a failed schema read is logged and the deploy goes ahead without the
 * warnings, because the checks are advisory.
 */
export async function frontendWarningsFor(tenantId: string, tenantSlug: string, files: CheckFile[]): Promise<FrontendWarning[]> {
  try {
    const active = await activeSchema(tenantId, tenantSlug)
    const slugsOf = (kind: string) => active.filter((m) => m.kind === kind).map((m) => m.slug)
    return checkFrontendSource(files, { contentTypes: slugsOf("contentTypes"), singleTypes: slugsOf("singleTypes") })
  } catch (err) {
    console.warn("[frontend-content-check] could not read the active schema; skipping source warnings:", err)
    return []
  }
}
