import { DocsClient } from "./docs-client"

export const metadata = {
  title: "API & Model Context Protocol (MCP) Documentation | SaCMS",
  description:
    "Comprehensive documentation for SaCMS REST API, TypeScript SDK, and Model Context Protocol (MCP) Server for Cursor, Claude, Windsurf, VS Code, and AI Agents.",
}

export default function DocsPage() {
  return <DocsClient />
}
