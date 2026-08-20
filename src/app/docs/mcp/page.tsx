import { redirect } from "next/navigation"

export const metadata = {
  title: "MCP Server Documentation | SaCMS",
  description: "Connect Claude, Cursor, Windsurf, Copilot, and AI Agents to SaCMS via Model Context Protocol.",
}

export default function MCPDocsRedirectPage() {
  redirect("/docs#mcp-overview")
}
