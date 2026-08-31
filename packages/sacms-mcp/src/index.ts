#!/usr/bin/env node
/**
 * SaCMS Model Context Protocol (MCP) Stdio Bridge
 *
 * Connects local AI Agents (Claude Desktop, Cursor, local tools) via standard I/O (stdio)
 * to remote SaCMS servers hosted on Vercel or Contabo VPS.
 *
 * Usage:
 *   bunx sacms-mcp --host https://your-cms.com --token <API_TOKEN>
 *   npx sacms-mcp --host https://your-cms.com --token <API_TOKEN>
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

// ─── Parse Arguments ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let host = process.env.SACMS_HOST || "http://localhost:3000"
let token = process.env.SACMS_TOKEN || ""

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--host" && args[i + 1]) {
    host = args[++i]
  } else if (args[i] === "--token" && args[i + 1]) {
    token = args[++i]
  }
}

if (host.endsWith("/")) {
  host = host.slice(0, -1)
}

const mcpEndpoint = host.endsWith("/api/mcp") ? host : `${host}/api/mcp`

// ─── Create Local MCP Stdio Server ───────────────────────────────────────────

const server = new Server(
  {
    name: "sacms-mcp-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
)

// ─── Remote JSON-RPC Forwarder ───────────────────────────────────────────────

async function forwardJsonRpc(method: string, params?: Record<string, any>) {
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params: params || {},
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(mcpEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Remote SaCMS MCP Error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error))
  }

  return data.result
}

// ─── Register Handlers ───────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const result = await forwardJsonRpc("tools/list")
    return result || { tools: [] }
  } catch (err: any) {
    console.error("[SaCMS Bridge] Error fetching tools/list:", err.message)
    return { tools: [] }
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await forwardJsonRpc("tools/call", {
      name: request.params.name,
      arguments: request.params.arguments,
    })
    return result || { content: [{ type: "text", text: "Done" }] }
  } catch (err: any) {
    console.error(`[SaCMS Bridge] Error calling tool ${request.params.name}:`, err.message)
    return {
      content: [{ type: "text", text: `❌ Error: ${err.message}` }],
      isError: true,
    }
  }
})

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  try {
    const result = await forwardJsonRpc("prompts/list")
    return result || { prompts: [] }
  } catch {
    return { prompts: [] }
  }
})

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const result = await forwardJsonRpc("resources/list")
    return result || { resources: [] }
  } catch {
    return { resources: [] }
  }
})

// ─── Start Stdio Transport ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[SaCMS MCP Bridge] Connected to ${mcpEndpoint} over stdio.`)
}

main().catch((err) => {
  console.error("[SaCMS MCP Bridge] Fatal error:", err)
  process.exit(1)
})
