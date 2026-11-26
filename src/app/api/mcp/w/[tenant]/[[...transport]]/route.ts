import { handleMcpRequest } from "@/app/api/mcp/[[...transport]]/route"

// One workspace's MCP endpoint: https://<origin>/api/mcp/w/<slug>. Same tools and
// auth as /api/mcp, but the URL fixes the workspace, so a token from another
// workspace is refused (403) instead of silently editing the wrong site.
type Ctx = { params: Promise<{ tenant: string; transport?: string[] }> }

async function run(req: Request, context: Ctx): Promise<Response> {
  const { tenant } = await context.params
  return handleMcpRequest(req, { workspaceSlug: tenant })
}

export async function GET(req: Request, context: Ctx) {
  return run(req, context)
}

export async function POST(req: Request, context: Ctx) {
  return run(req, context)
}

export async function DELETE(req: Request, context: Ctx) {
  return run(req, context)
}
