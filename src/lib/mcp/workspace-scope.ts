/**
 * A workspace-scoped MCP endpoint (`/api/mcp/w/<segment>`) only serves tokens that
 * belong to that workspace. The segment may be the workspace's slug or its id,
 * since the dashboard can open a workspace by either. Returns the error message
 * when the token does not match, or null when the request may continue. The
 * shared endpoint (`/api/mcp`) has no scope and returns null.
 */
export function workspaceScopeError(
  token: { tenantId: string; tenantSlug: string },
  urlWorkspace?: string,
): string | null {
  if (!urlWorkspace) return null
  if (urlWorkspace === token.tenantSlug || urlWorkspace === token.tenantId) return null
  return `This token belongs to workspace "${token.tenantSlug}", not "${urlWorkspace}". Connect with the Server URL of the workspace this token was made for.`
}
