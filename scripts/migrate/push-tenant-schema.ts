import { execFileSync } from "node:child_process"
import { db, getTenantDatabaseUrl } from "@/lib/database"

export async function pushTenantSchema(tenantIdentifier?: string, options: { acceptDataLoss?: boolean } = {}) {
  const select = { id: true, slug: true, databaseUrl: true } as const
  const explicit = tenantIdentifier && tenantIdentifier !== "--all"
  const tenants = explicit
    ? await db.tenant.findMany({ where: { OR: [{ id: tenantIdentifier }, { slug: tenantIdentifier }] }, select })
    : await db.tenant.findMany({ select })
  if (explicit && tenants.length !== 1) throw new Error("Use an unambiguous workspace ID or slug.")

  const targets = new Map<string, string>()
  for (const tenant of tenants) {
    const url = await getTenantDatabaseUrl(tenant)
    if (url && !targets.has(url)) targets.set(url, tenant.slug)
  }
  if (targets.size === 0) {
    console.log("No configured dedicated database matched.")
    return
  }
  if (!tenantIdentifier && targets.size > 1) {
    throw new Error("Specify a workspace ID, slug, or --all to update multiple dedicated databases.")
  }

  const args = ["x", "prisma", "db", "push", "--skip-generate"]
  if (options.acceptDataLoss) args.push("--accept-data-loss")
  for (const [databaseUrl, slug] of targets) {
    console.log(`Updating the dedicated database for "${slug}".`)
    execFileSync("bun", args, {
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
      stdio: "inherit",
    })
  }
}

export async function runTenantSchemaPush(args: string[]) {
  try {
    const acceptDataLoss = args.includes("--accept-data-loss")
    const targets = args.filter((arg) => arg !== "--accept-data-loss")
    if (targets.length > 1 || targets.some((arg) => arg.startsWith("-") && arg !== "--all") ||
        (acceptDataLoss && targets.length === 0)) {
      throw new Error("Usage: db:tenant:push <workspace-id|slug|--all> [--accept-data-loss]")
    }
    await pushTenantSchema(targets[0], { acceptDataLoss })
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

if (import.meta.main) await runTenantSchemaPush(process.argv.slice(2))
