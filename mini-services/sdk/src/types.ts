/** Filter operators supported by the SaCMS API */
export interface FilterOperators {
  $eq?: string | number | boolean
  $ne?: string | number | boolean
  $gt?: string | number
  $gte?: string | number
  $lt?: string | number
  $lte?: string | number
  $contains?: string
  $startsWith?: string
  $endsWith?: string
  $in?: (string | number)[]
  $notIn?: (string | number)[]
  $null?: boolean
  $notNull?: boolean
}

export type Filters = Record<string, FilterOperators | string | number | boolean> & {
  $or?: Filters[]
  $and?: Filters[]
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface FindManyParams {
  filters?: Filters
  fields?: string[]
  /** Seventh external audit: `findOne` already accepted `"*"` (every relation); `findMany` crashed on it with a raw TypeError (`"*".map` isn't a function) — now consistent. */
  populate?: string[] | "*"
  locale?: string
  sort?: string
  pagination?: PaginationParams
  search?: string
  status?: string
}

export interface FindSingleParams {
  locale?: string
}

/**
 * Sixth external audit: findOne() didn't accept either of these at all —
 * the server's own single-entry GET route (confirmed: `src/app/api/public/
 * [tenant]/content/[contentType]/[id]/route.ts`) supports both `?populate=`
 * and `?locale=` already, the SDK just never built them into the request,
 * so a relation always came back as a raw id regardless of what you asked
 * list/findMany for.
 */
export interface FindOneParams {
  populate?: string[] | "*"
  locale?: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CollectionResponse<T = Record<string, unknown>> {
  data: T[]
  meta: {
    contentType: { name: string; slug: string }
    pagination: PaginationMeta
  }
}

export interface SingleResponse<T = Record<string, unknown>> {
  data: T
  meta: {
    singleType: { name: string; slug: string }
    locale: string
  }
}

export interface GraphQLResponse<T = Record<string, unknown>> {
  data: T
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>
}

export interface SaCMSConfig {
  baseUrl: string
  tenant: string
  /**
   * Optional — the public Content API works anonymously for published
   * content (confirmed: `resolvePublicApiActor` falls back to a "public"
   * role when no Authorization header is sent at all). Only needed for a
   * full-access/read-only API token, or to read non-PUBLISHED content.
   * Omit it rather than passing `""` as a workaround — both are now
   * treated identically (see the client's own request() comment for why
   * that distinction used to matter).
   */
  token?: string
  locale?: string
  /**
   * Default timeout (in ms) applied to every request made by this client,
   * overridable per call via `RequestExtras.timeoutMs` (pass `0` to disable
   * it for a single call). Defaults to 15000 — unset before, a hung
   * connection to the server could block a page's render indefinitely.
   */
  timeoutMs?: number
}

export interface MutateParams {
  data: Record<string, unknown>
  locale?: string
  status?: string
}

/**
 * Extra, per-call request behavior — every `find*`/`create`/`update`/
 * `delete`/`graphql` method accepts this as its last argument.
 *
 * `next`/`cache` are passed straight through to the underlying `fetch()`
 * call, so Next.js's own data-cache controls (`next: { revalidate, tags }`)
 * work directly through this SDK instead of needing to wrap every call in
 * `unstable_cache` yourself. They're simply ignored (not an error) by a
 * plain, non-Next.js `fetch`.
 */
export interface RequestExtras {
  /** Passed through to fetch(); meaningful only inside a Next.js server context (app router). */
  next?: { revalidate?: number | false; tags?: string[] }
  cache?: RequestInit["cache"]
  headers?: RequestInit["headers"]
  /** Overrides SaCMSConfig.timeoutMs for this one call. `0` disables the timeout entirely for this call. Ignored when you also pass your own `signal`. */
  timeoutMs?: number
  /** Your own abort signal, if you need to cancel this call yourself — when set, the client's internal timeout is skipped and this signal governs abort instead. */
  signal?: AbortSignal
}
