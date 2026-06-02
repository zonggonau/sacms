import { db } from "@/lib/database"
import { GraphiQLWrapper } from "@/components/cms/graphiql-wrapper"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, KeyRound } from "lucide-react"
import { headers } from "next/headers"

export default async function GraphQLPlaygroundPage({
  params
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  
  // Try to find a valid API token for this tenant
  const apiToken = await db.apiToken.findFirst({
    where: { 
      tenantId: tenant,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  })

  // We need the base URL for the API endpoint
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3001"
  const protocol = host.includes("localhost") ? "http" : "https"
  const endpoint = `${protocol}://${host}/api/public/${tenant}/graphql`

  if (!apiToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">API Token Required</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          To use the GraphQL Playground, you need an active API Token for authentication. 
          The playground uses this token to run real queries against your database.
        </p>
        <Link href={`/dashboard/${tenant}/api-keys`}>
          <Button className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Create API Token
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background relative" style={{ isolation: 'isolate' }}>
      <GraphiQLWrapper 
        endpoint={endpoint}
        apiToken={apiToken.token}
      />
    </div>
  )
}
