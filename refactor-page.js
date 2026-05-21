const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/page.tsx');
const clientPath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/client-page.tsx');

let content = fs.readFileSync(pagePath, 'utf8');

// Edit content for client-page.tsx
let clientContent = content;

// Replace definition
clientContent = clientContent.replace(
  /export default function TenantDashboardPage\(\) \{/,
  `export default function TenantDashboardClient({
  tenantId,
  contentTypes,
  stats,
  usage,
}: {
  tenantId: string
  contentTypes: AssignedContentType[]
  stats: TenantStats
  usage: any[]
}) {`
);

// Remove the states for these props
clientContent = clientContent.replace(/const \[contentTypes, setContentTypes\] = useState<AssignedContentType\[\]>\(\[\]\)\n/, '');
clientContent = clientContent.replace(/const \[stats, setStats\] = useState<TenantStats \| null>\(null\)\n/, '');
clientContent = clientContent.replace(/const \[usage, setUsage\] = useState<any\[\]>\(\[\]\)\n/, '');
clientContent = clientContent.replace(/const \[loading, setLoading\] = useState\(true\)\n/, '');

// Remove the params retrieval
clientContent = clientContent.replace(/const params = useParams\(\)\n/, '');
clientContent = clientContent.replace(/const tenantId = params\?\.tenant as string\n/, '');

// Remove the fetchData useEffect block entirely
const useEffectMatch = clientContent.match(/useEffect\(\(\) => \{\n\s*async function fetchData\(\) \{[\s\S]*?if \(session\?\.user\) fetchData\(\)\n\s*\}, \[tenantId, session\]\)/);
if (useEffectMatch) {
  clientContent = clientContent.replace(useEffectMatch[0], '');
}

// Remove loading check
const loadingCheckMatch = clientContent.match(/if \(status === "loading" \|\| \(loading && !stats\)\) \{[\s\S]*?\n\s*\}/);
if (loadingCheckMatch) {
  clientContent = clientContent.replace(loadingCheckMatch[0], 
  `if (status === "loading" || !stats) {
    return (
      <div className="flex items-center justify-center bg-background text-foreground flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }`);
}

fs.writeFileSync(clientPath, clientContent, 'utf8');

// Now create the new page.tsx Server Component
const newPageContent = `import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { redirect } from "next/navigation"
import TenantDashboardClient from "./client-page"

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  
  if (!access) redirect("/dashboard")

  const tenantId = access.tenantId
  const tenantDb = await getTenantDb(tenantSlug)

  // 1. Fetch Content Types
  const availableContentTypes = await tenantDb.contentType.findMany({
    where: {
      OR: [
        { tenantId: tenantId },
        { tenants: { some: { tenantId: tenantId, enabled: true } } }
      ]
    },
    include: { fields: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  })

  const contentTypes = await Promise.all(
    availableContentTypes.map(async (contentType) => {
      const entryCount = await tenantDb.contentEntry.count({
        where: { contentTypeId: contentType.id, tenantId: tenantId },
      })

      const formattedFields = contentType.fields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch (e) { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions }
      })

      return {
        ...contentType,
        fields: formattedFields,
        entryCount,
        isGlobal: false,
      }
    })
  )

  // 2. Fetch Stats
  const [
    tenantData,
    contentTypeCount,
    singleTypeCount,
    entriesByStatus,
    apiTokenCount,
    webhookCount,
    recentEntries,
    superAdmins,
  ] = await Promise.all([
    tenantDb.tenant.findUnique({
      where: { id: tenantId },
      select: { _count: { select: { members: true, media: true } } }
    }),
    tenantDb.tenantContentTypeAssignment.count({ where: { tenantId } }),
    tenantDb.tenantSingleTypeAssignment.count({ where: { tenantId } }),
    tenantDb.contentEntry.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    tenantDb.apiToken.count({ where: { tenantId } }),
    tenantDb.webhook.count({ where: { tenantId } }),
    tenantDb.contentEntry.findMany({
      where: { tenantId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: true,
        contentType: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.user.findMany({ where: { role: "super_admin" }, select: { id: true } })
  ])

  const superAdminIds = new Set(superAdmins.map(u => u.id))
  const filteredRecentEntries = recentEntries
    .filter(e => !e.updatedBy || !superAdminIds.has(e.updatedBy))
    .slice(0, 8)

  const statusMap = Object.fromEntries(
    (entriesByStatus || []).map((g) => [g.status.toLowerCase(), g._count._all])
  )

  const totalEntries = entriesByStatus ? Object.values(statusMap).reduce((a, b) => (a as number) + (b as number), 0) : 0

  const stats = {
    tenant: access.tenant,
    contentTypeCount,
    singleTypeCount,
    totalEntries,
    mediaCount: tenantData?._count?.media || 0,
    memberCount: tenantData?._count?.members || 0,
    apiTokenCount,
    webhookCount,
    entries: {
      draft: statusMap["draft"] || 0,
      in_review: statusMap["in_review"] || 0,
      approved: statusMap["approved"] || 0,
      scheduled: statusMap["scheduled"] || 0,
      published: statusMap["published"] || 0,
      archived: statusMap["archived"] || 0,
    },
    recentEntries: filteredRecentEntries.map((e) => ({
      id: e.id,
      status: e.status,
      contentType: e.contentType.name,
      contentTypeSlug: e.contentType.slug,
      updatedAt: e.updatedAt.toISOString(),
    })),
  }

  // 3. Fetch Usage
  const mediaSizeSum = await db.media.aggregate({
    where: { tenantId },
    _sum: { size: true }
  })
  
  const rawPlan = access.tenant.plan || "free"
  const plan = rawPlan.toLowerCase()
  
  const LIMITS: Record<string, any> = {
    free: { entries: 100, mediaSize: 100 * 1024 * 1024, users: 3 },
    starter: { entries: 1000, mediaSize: 1 * 1024 * 1024 * 1024, users: 5 },
    pro: { entries: 10000, mediaSize: 10 * 1024 * 1024 * 1024, users: 20 },
    business: { entries: 50000, mediaSize: 50 * 1024 * 1024 * 1024, users: 50 },
    enterprise: { entries: 1000000, mediaSize: 1000 * 1024 * 1024 * 1024, users: 100 }
  }

  const currentLimits = LIMITS[plan] || LIMITS.free

  const usage = [
    {
      label: "Content Entries",
      current: totalEntries,
      limit: currentLimits.entries,
      unit: "entries"
    },
    {
      label: "Media Storage",
      current: Number(mediaSizeSum._sum?.size || 0),
      limit: currentLimits.mediaSize,
      unit: "bytes"
    },
    {
      label: "Team Members",
      current: tenantData?._count?.members || 0,
      limit: currentLimits.users,
      unit: "users"
    }
  ]

  // Fix updatedAt date types
  const serializedContentTypes = contentTypes.map(ct => ({
    ...ct,
    createdAt: ct.createdAt.toISOString(),
    updatedAt: ct.updatedAt.toISOString(),
  }))

  return (
    <TenantDashboardClient 
      tenantId={tenantId}
      contentTypes={serializedContentTypes as any}
      stats={stats}
      usage={usage}
    />
  )
}
`;

fs.writeFileSync(pagePath, newPageContent, 'utf8');

console.log("Refactoring complete");
