/**
 * Hand-off for a just-created/regenerated MCP token's plaintext value
 * between /developer/api-keys (where it's generated) and /developer/mcp
 * (where it's used to pre-fill setup snippets) — both in the same browser
 * tab, without a full page reload losing React state.
 *
 * The server only ever stores a SHA-256 hash of the token (see
 * src/actions/mcp-tokens.ts) — the plaintext is irretrievable once this
 * session forgets it. sessionStorage is the right place for that: it never
 * reaches the server, and disappears when the tab/browser closes, so this
 * carries the exact same exposure as the one-time reveal dialogs already
 * showing the plaintext — just not scoped to a single page's component tree.
 */

function key(tenantId: string, tokenId: string): string {
  return `sacms:mcp_token_plain:${tenantId}:${tokenId}`
}

export function rememberMcpTokenPlain(tenantId: string, tokenId: string, plainToken: string): void {
  try {
    sessionStorage.setItem(key(tenantId, tokenId), plainToken)
  } catch {
    // Private browsing / storage disabled — the hand-off just won't happen.
  }
}

export function recallMcpTokenPlain(tenantId: string, tokenId: string): string | null {
  try {
    return sessionStorage.getItem(key(tenantId, tokenId))
  } catch {
    return null
  }
}

export function forgetMcpTokenPlain(tenantId: string, tokenId: string): void {
  try {
    sessionStorage.removeItem(key(tenantId, tokenId))
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
