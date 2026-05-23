const fs = require('fs');
const path = require('path');

const clientPagePath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/client-page.tsx');
let content = fs.readFileSync(clientPagePath, 'utf8');

// 1. Remove TenantSidebar import
content = content.replace(/import\s+\{\s*TenantSidebar\s*\}\s+from\s+["'][^"']*tenant-sidebar["']\s*;?\n?/g, '');

// 2. Adjust parameter definition and remove state/fetch useEffect
const stateAndFetchPattern = /export default function TenantDashboardClient\(\{([\s\S]*?)\}\:([\s\S]*?)\) \{([\s\S]*?)const tenants \= useMemo/;

const replacement = `export default function TenantDashboardClient({
  tenantId: initialTenantId,
  contentTypes,
  stats,
  usage,
}: {
  tenantId: string
  contentTypes: AssignedContentType[]
  stats: TenantStats
  usage: any[]
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantId = (params?.tenant as string) || initialTenantId

  const tenants = useMemo`;

content = content.replace(stateAndFetchPattern, replacement);

// 3. Replace the outer layout tags
content = content.replace(
  /<div className="flex h-screen overflow-hidden bg-muted\/10">([\s\S]*?)<TenantSidebar tenantId=\{tenantId\} \/>([\s\S]*?)<main className="flex-1 overflow-y-auto">([\s\S]*?)<\/main>([\s\S]*?)<\/div>/g,
  (match, p1, p2, p3, p4) => {
    return `<div className="flex-1 flex flex-col w-full">\n      <main className="flex-1">\n${p3}\n      </main>\n    </div>`;
  }
);

fs.writeFileSync(clientPagePath, content, 'utf8');
console.log('client-page.tsx refactoring script completed successfully!');
