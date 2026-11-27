// Central scope enforcement for the workspace MCP server. Every tool registration goes through
// withWorkspaceScopeGate, which checks the token's scope from WORKSPACE_TOOL_SCOPES before the
// handler runs. A tool with no entry fails at registration, so a new tool cannot ship ungated.
import { authContext, hasScope, permissionDenied, type McpServer } from "./context"
import { WORKSPACE_TOOL_SCOPES } from "./tool-scopes"

type ToolHandler = (...args: unknown[]) => unknown
type RegisterTool = (name: string, config: unknown, handler: ToolHandler) => unknown

export function withWorkspaceScopeGate(server: McpServer): McpServer {
  const registerTool = (server.registerTool as unknown as RegisterTool).bind(server)
  return new Proxy(server, {
    get(target, prop) {
      if (prop !== "registerTool") return Reflect.get(target, prop, target)
      return (name: string, config: unknown, handler: ToolHandler) => {
        const scope = WORKSPACE_TOOL_SCOPES[name]
        if (!scope) throw new Error(`Workspace MCP tool "${name}" has no entry in WORKSPACE_TOOL_SCOPES`)
        return registerTool(name, config, (...args: unknown[]) => {
          // With no auth in the store, the handler's own UNAUTHORIZED check answers.
          const auth = authContext.getStore()
          if (auth && !hasScope(auth, scope)) return permissionDenied(scope)
          return handler(...args)
        })
      }
    },
  })
}
