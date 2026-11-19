/** The configured data database could not serve this request. */
export class TenantDatabaseUnavailableError extends Error {
  readonly status = 503

  constructor() {
    super("Workspace database is temporarily unavailable. Try again shortly.")
    this.name = "TenantDatabaseUnavailableError"
  }
}
