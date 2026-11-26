/**
 * A workspace-scoped MCP endpoint (`/api/mcp/w/<slug>`) only serves tokens that
 * belong to that workspace. Returns the error message when they do not match,
 * or null when the request may continue. The shared endpoint (`/api/mcp`) has no
 * scope and returns null.
 */
export function workspaceScopeError(tokenWorkspaceSlug: string, urlWorkspaceSlug?: string): string | null {
  if (!urlWorkspaceSlug) return null
  if (tokenWorkspaceSlug === urlWorkspaceSlug) return null
  return `This token belongs to workspace "${tokenWorkspaceSlug}", not "${urlWorkspaceSlug}". Connect with the Server URL of the workspace this token was made for.`
}
