export function resolveExplorerUrl(endpoint: string, origin: string, tenant: string): URL | null {
  try {
    const url = new URL(endpoint.trim(), origin)
    const prefix = `/api/public/${encodeURIComponent(tenant)}/`
    if (url.origin !== origin || url.username || url.password || !url.pathname.startsWith(prefix)) {
      return null
    }
    return url
  } catch {
    return null
  }
}
