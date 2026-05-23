import type {
  SaCMSConfig,
  FindManyParams,
  FindSingleParams,
  CollectionResponse,
  SingleResponse,
  GraphQLResponse,
  MutateParams,
  Filters,
  FilterOperators,
} from "./types"
import type { SaCMSRegistry } from "./generated-types"

export class SaCMS {
  private baseUrl: string
  private tenant: string
  private token: string
  private defaultLocale?: string

  constructor(config: SaCMSConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "")
    this.tenant = config.tenant
    this.token = config.token
    this.defaultLocale = config.locale
  }

  /**
   * Access a collection content type for querying or mutating entries.
   */
  collection<K extends keyof SaCMSRegistry["collections"]>(slug: K): CollectionClient<SaCMSRegistry["collections"][K]>
  collection<T = Record<string, unknown>>(slug: string): CollectionClient<T>
  collection(slug: string) {
    return new CollectionClient(this, slug)
  }

  /**
   * Access a single type for querying its content.
   */
  single<K extends keyof SaCMSRegistry["singles"]>(slug: K): SingleClient<SaCMSRegistry["singles"][K]>
  single<T = Record<string, unknown>>(slug: string): SingleClient<T>
  single(slug: string) {
    return new SingleClient(this, slug)
  }

  /**
   * Execute a raw GraphQL query or mutation.
   */
  async graphql<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    return this.request<GraphQLResponse<T>>(
      `/api/public/${this.tenant}/graphql`,
      {
        method: "POST",
        body: JSON.stringify({ query, variables }),
      }
    )
  }

  /** @internal */
  async request<T>(path: string, init?: RequestInit, retries = 3): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, { ...init, headers })
      
      if (res.status === 429 && attempt < retries) {
        const retryAfter = res.headers.get("Retry-After")
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt)
        await new Promise(r => setTimeout(r, delay))
        continue
      }

      if (!res.ok) {
        const body = await res.text()
        let message: string
        try {
          const json = JSON.parse(body)
          message = json.error || json.message || body
        } catch {
          message = body
        }
        throw new SaCMSError(message, res.status)
      }
      return res.json() as Promise<T>
    }
    throw new SaCMSError("Max retries reached", 429)
  }

  /** @internal */
  getDefaultLocale() {
    return this.defaultLocale
  }

  /** @internal */
  getTenant() {
    return this.tenant
  }
}

class CollectionClient<T> {
  constructor(
    private cf: SaCMS,
    private slug: string
  ) {}

  /**
   * Start a fluent query builder chain.
   */
  query() {
    return new QueryBuilder<T>(this)
  }

  /**
   * Query multiple entries with filtering, sorting, pagination, and field selection.
   */
  async findMany(
    params?: FindManyParams
  ): Promise<CollectionResponse<T>> {
    const qs = buildQueryString(params, this.cf.getDefaultLocale())
    return this.cf.request<CollectionResponse<T>>(
      `/api/public/${this.cf.getTenant()}/content/${this.slug}${qs}`
    )
  }

  /**
   * Get a single entry by ID.
   */
  async findOne(id: string): Promise<{ data: T }> {
    return this.cf.request<{ data: T }>(
      `/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`
    )
  }

  /**
   * Create a new entry (requires full-access token).
   */
  async create(params: MutateParams): Promise<{ data: T }> {
    return this.cf.request<{ data: T }>(
      `/api/public/${this.cf.getTenant()}/content/${this.slug}`,
      {
        method: "POST",
        body: JSON.stringify({
          data: params.data,
          locale: params.locale ?? this.cf.getDefaultLocale(),
          status: params.status,
        }),
      }
    )
  }

  /**
   * Update an entry by ID (requires full-access token).
   */
  async update(
    id: string,
    params: MutateParams
  ): Promise<{ data: T }> {
    return this.cf.request<{ data: T }>(
      `/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          data: params.data,
          locale: params.locale ?? this.cf.getDefaultLocale(),
          status: params.status,
        }),
      }
    )
  }

  /**
   * Delete an entry by ID (requires full-access token).
   */
  async delete(id: string): Promise<{ success: boolean }> {
    return this.cf.request<{ success: boolean }>(
      `/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    )
  }
}

class SingleClient<T> {
  constructor(
    private cf: SaCMS,
    private slug: string
  ) {}

  /**
   * Get the single type content.
   */
  async find(
    params?: FindSingleParams
  ): Promise<SingleResponse<T>> {
    const locale = params?.locale ?? this.cf.getDefaultLocale()
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : ""
    return this.cf.request<SingleResponse<T>>(
      `/api/public/${this.cf.getTenant()}/single/${this.slug}${qs}`
    )
  }

  /**
   * Update the single type content (requires full-access token).
   */
  async update(
    data: Record<string, unknown>
  ): Promise<SingleResponse<T>> {
    return this.cf.request<SingleResponse<T>>(
      `/api/public/${this.cf.getTenant()}/single/${this.slug}`,
      {
        method: "PUT",
        body: JSON.stringify({ data }),
      }
    )
  }
}

export class SaCMSError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = "SaCMSError"
  }
}

export class QueryBuilder<T> {
  private params: FindManyParams = {}

  constructor(private client: CollectionClient<T>) {}

  /**
   * Filter data. E.g. .where('status', 'eq', 'PUBLISHED')
   */
  where(field: string, operator: string, value: any) {
    if (!this.params.filters) this.params.filters = {}
    if (!this.params.filters[field]) this.params.filters[field] = {}
    const op = operator.startsWith('$') ? operator : `$${operator}`
    ;(this.params.filters[field] as any)[op] = value
    return this
  }

  /**
   * Select specific relations to populate. E.g. .populate(['author'])
   */
  populate(fields: string[]) {
    this.params.populate = fields
    return this
  }

  /**
   * Limit the number of returned entries.
   */
  limit(pageSize: number) {
    if (!this.params.pagination) this.params.pagination = {}
    this.params.pagination.pageSize = pageSize
    return this
  }

  /**
   * Skip a number of pages.
   */
  page(pageNumber: number) {
    if (!this.params.pagination) this.params.pagination = {}
    this.params.pagination.page = pageNumber
    return this
  }

  /**
   * Execute the query and fetch the results.
   */
  async fetch(): Promise<CollectionResponse<T>> {
    return this.client.findMany(this.params)
  }
}

// ─── Helpers ────────────────────────────────────────────

function buildQueryString(
  params?: FindManyParams,
  defaultLocale?: string
): string {
  if (!params) return ""
  const parts: string[] = []

  if (params.filters) {
    flattenFilters(params.filters, "filters", parts)
  }

  if (params.fields?.length) {
    parts.push(`fields=${params.fields.map(encodeURIComponent).join(",")}`)
  }

  if (params.populate?.length) {
    parts.push(`populate=${params.populate.map(encodeURIComponent).join(",")}`)
  }

  const locale = params.locale ?? defaultLocale
  if (locale) {
    parts.push(`locale=${encodeURIComponent(locale)}`)
  }

  if (params.sort) {
    parts.push(`sort=${encodeURIComponent(params.sort)}`)
  }

  if (params.pagination) {
    if (params.pagination.page != null) {
      parts.push(`pagination[page]=${params.pagination.page}`)
    }
    if (params.pagination.pageSize != null) {
      parts.push(`pagination[pageSize]=${params.pagination.pageSize}`)
    }
  }

  if (params.search) {
    parts.push(`search=${encodeURIComponent(params.search)}`)
  }

  if (params.status) {
    parts.push(`status=${encodeURIComponent(params.status)}`)
  }

  return parts.length ? `?${parts.join("&")}` : ""
}

function flattenFilters(
  filters: Filters,
  prefix: string,
  parts: string[]
): void {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "$or" || key === "$and") {
      const arr = value as Filters[]
      arr.forEach((item, i) => {
        flattenFilters(item, `${prefix}[${key}][${i}]`, parts)
      })
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const ops = value as FilterOperators
      for (const [op, opVal] of Object.entries(ops)) {
        if (Array.isArray(opVal)) {
          opVal.forEach((v, i) => {
            parts.push(
              `${prefix}[${encodeURIComponent(key)}][${op}][${i}]=${encodeURIComponent(String(v))}`
            )
          })
        } else {
          parts.push(
            `${prefix}[${encodeURIComponent(key)}][${op}]=${encodeURIComponent(String(opVal))}`
          )
        }
      }
    } else {
      // Shorthand: filters[field]=value  →  filters[field][$eq]=value
      parts.push(
        `${prefix}[${encodeURIComponent(key)}][$eq]=${encodeURIComponent(String(value))}`
      )
    }
  }
}
