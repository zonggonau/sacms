/**
 * Hand-off for a just-created/regenerated REST/GraphQL API key's plaintext
 * value between /developer/api-keys (where it's generated) and pages that
 * need it to actually call the API (e.g. /developer/api's REST Explorer and
 * GraphQL Playground) — same browser tab, without a full page reload
 * losing React state.
 *
 * The server only ever stores a SHA-256 hash of the key (see
 * src/actions/api-keys.ts) — the plaintext is irretrievable once this
 * session forgets it. sessionStorage is the right place for that: it never
 * reaches the server, and disappears when the tab/browser closes. Mirrors
 * src/lib/mcp-token-storage.ts for the MCP token hand-off.
 */

function key(tenantId: string, tokenId: string): string {
  return `sacms:api_token_plain:${tenantId}:${tokenId}`
}

export function rememberApiTokenPlain(tenantId: string, tokenId: string, plainToken: string): void {
  try {
    sessionStorage.setItem(key(tenantId, tokenId), plainToken)
  } catch {
    // Private browsing / storage disabled — the hand-off just won't happen.
  }
}

export function recallApiTokenPlain(tenantId: string, tokenId: string): string | null {
  try {
    return sessionStorage.getItem(key(tenantId, tokenId))
  } catch {
    return null
  }
}

export function forgetApiTokenPlain(tenantId: string, tokenId: string): void {
  try {
    sessionStorage.removeItem(key(tenantId, tokenId))
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
