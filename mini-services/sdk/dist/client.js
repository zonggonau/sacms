"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = exports.SaCMSError = exports.SaCMS = void 0;
const auth_1 = require("./auth");
/**
 * `SaCMS` is generic over your own, per-workspace schema registry — there is
 * no tenant-specific schema baked into this package. Run `npx @sacms/sdk
 * generate --url ... --tenant ... --token ... --out src/types/sacms.ts` to
 * generate one from your real workspace, then:
 *
 *   import { SaCMS } from "@sacms/sdk"
 *   import type { MyRegistry } from "./types/sacms"
 *
 *   const sacms = new SaCMS<MyRegistry>({ baseUrl, tenant, token })
 *   // sacms.collection("articles") is now typed from MyRegistry, not a guess.
 *
 * Without a registry type argument, `collection()`/`single()` accept any
 * slug and fall back to `Record<string, unknown>` (or an explicit generic
 * you pass per call) — exactly as if the schema were untyped.
 */
class SaCMS {
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.tenant = config.tenant;
        this.token = config.token;
        this.defaultLocale = config.locale ?? "id";
        this.auth = new auth_1.AuthClient(this);
    }
    collection(slug) {
        return new CollectionClient(this, slug);
    }
    single(slug) {
        return new SingleClient(this, slug);
    }
    /**
     * Execute a raw GraphQL query or mutation.
     */
    async graphql(query, variables) {
        return this.request(`/api/public/${this.tenant}/graphql`, {
            method: "POST",
            body: JSON.stringify({ query, variables }),
        });
    }
    /** @internal */
    async request(path, init, retries = 3) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            ...init?.headers,
        };
        for (let attempt = 0; attempt <= retries; attempt++) {
            let res;
            try {
                res = await fetch(url, { ...init, headers });
            }
            catch (err) {
                // A pure network failure (connection reset, DNS, timeout) throws
                // before there's any Response to inspect — retry it the same way
                // as a 429, instead of letting it escape as a raw, un-typed
                // exception that the README's `catch (SaCMSError)` pattern can't
                // catch.
                if (attempt < retries) {
                    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
                    continue;
                }
                throw new SaCMSError(err instanceof Error ? err.message : "Network request failed", 0);
            }
            if (res.status === 429 && attempt < retries) {
                const retryAfter = res.headers.get("Retry-After");
                const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            if (!res.ok) {
                const body = await res.text();
                let message;
                try {
                    const json = JSON.parse(body);
                    message = json.error || json.message || body;
                }
                catch {
                    message = body;
                }
                throw new SaCMSError(message, res.status);
            }
            return res.json();
        }
        throw new SaCMSError("Max retries reached", 429);
    }
    /** @internal */
    getDefaultLocale() {
        return this.defaultLocale;
    }
    /** @internal */
    getTenant() {
        return this.tenant;
    }
}
exports.SaCMS = SaCMS;
class CollectionClient {
    constructor(cf, slug) {
        this.cf = cf;
        this.slug = slug;
    }
    /**
     * Start a fluent query builder chain.
     */
    query() {
        return new QueryBuilder(this);
    }
    /**
     * Query multiple entries with filtering, sorting, pagination, and field selection.
     */
    async findMany(params) {
        const qs = buildQueryString(params, this.cf.getDefaultLocale());
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}${qs}`);
    }
    /**
     * Get a single entry by ID.
     */
    async findOne(id) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`);
    }
    /**
     * Create a new entry (requires full-access token).
     */
    async create(params) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}`, {
            method: "POST",
            body: JSON.stringify({
                data: params.data,
                locale: params.locale ?? this.cf.getDefaultLocale(),
                status: params.status,
            }),
        });
    }
    /**
     * Update an entry by ID (requires full-access token).
     */
    async update(id, params) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
                data: params.data,
                locale: params.locale ?? this.cf.getDefaultLocale(),
                status: params.status,
            }),
        });
    }
    /**
     * Delete an entry by ID (requires full-access token).
     */
    async delete(id) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
}
class SingleClient {
    constructor(cf, slug) {
        this.cf = cf;
        this.slug = slug;
    }
    /**
     * Get the single type content.
     */
    async find(params) {
        const locale = params?.locale ?? this.cf.getDefaultLocale();
        const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
        return this.cf.request(`/api/public/${this.cf.getTenant()}/single/${this.slug}${qs}`);
    }
    /**
     * Update the single type content (requires full-access token).
     */
    async update(data) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/single/${this.slug}`, {
            method: "PUT",
            body: JSON.stringify({ data }),
        });
    }
}
class SaCMSError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "SaCMSError";
    }
}
exports.SaCMSError = SaCMSError;
class QueryBuilder {
    constructor(client) {
        this.client = client;
        this.params = {};
    }
    /**
     * Filter data. E.g. .where('status', 'eq', 'PUBLISHED')
     */
    where(field, operator, value) {
        if (!this.params.filters)
            this.params.filters = {};
        if (!this.params.filters[field])
            this.params.filters[field] = {};
        const op = operator.startsWith('$') ? operator : `$${operator}`;
        this.params.filters[field][op] = value;
        return this;
    }
    /**
     * Select specific fields to return. E.g. .select(['title', 'slug', 'cover'])
     */
    select(fields) {
        this.params.fields = fields;
        return this;
    }
    /**
     * Select specific relations to populate. E.g. .populate(['author'])
     */
    populate(fields) {
        this.params.populate = fields;
        return this;
    }
    /**
     * Sort results. E.g. .sort('createdAt:desc') or .sort('title:asc')
     */
    sort(sortOrder) {
        this.params.sort = sortOrder;
        return this;
    }
    /**
     * Full-text search across content entries. E.g. .search('nextjs tutorial')
     */
    search(query) {
        this.params.search = query;
        return this;
    }
    /**
     * Target a specific locale. E.g. .locale('id') or .locale('en')
     */
    locale(loc) {
        this.params.locale = loc;
        return this;
    }
    /**
     * Filter by status. E.g. .status('PUBLISHED') or .status('DRAFT')
     */
    status(st) {
        this.params.status = st;
        return this;
    }
    /**
     * Limit the number of returned entries.
     */
    limit(pageSize) {
        if (!this.params.pagination)
            this.params.pagination = {};
        this.params.pagination.pageSize = pageSize;
        return this;
    }
    /**
     * Skip a number of pages.
     */
    page(pageNumber) {
        if (!this.params.pagination)
            this.params.pagination = {};
        this.params.pagination.page = pageNumber;
        return this;
    }
    /**
     * Execute the query and fetch the results.
     */
    async fetch() {
        return this.client.findMany(this.params);
    }
}
exports.QueryBuilder = QueryBuilder;
// ─── Helpers ────────────────────────────────────────────
function buildQueryString(params, defaultLocale) {
    if (!params)
        return "";
    const parts = [];
    if (params.filters) {
        flattenFilters(params.filters, "filters", parts);
    }
    if (params.fields?.length) {
        parts.push(`fields=${params.fields.map(encodeURIComponent).join(",")}`);
    }
    if (params.populate?.length) {
        parts.push(`populate=${params.populate.map(encodeURIComponent).join(",")}`);
    }
    const locale = params.locale ?? defaultLocale;
    if (locale) {
        parts.push(`locale=${encodeURIComponent(locale)}`);
    }
    if (params.sort) {
        parts.push(`sort=${encodeURIComponent(params.sort)}`);
    }
    if (params.pagination) {
        if (params.pagination.page != null) {
            parts.push(`pagination[page]=${params.pagination.page}`);
        }
        if (params.pagination.pageSize != null) {
            parts.push(`pagination[pageSize]=${params.pagination.pageSize}`);
        }
    }
    if (params.search) {
        parts.push(`search=${encodeURIComponent(params.search)}`);
    }
    if (params.status) {
        parts.push(`status=${encodeURIComponent(params.status)}`);
    }
    return parts.length ? `?${parts.join("&")}` : "";
}
function flattenFilters(filters, prefix, parts) {
    for (const [key, value] of Object.entries(filters)) {
        if (key === "$or" || key === "$and") {
            const arr = value;
            arr.forEach((item, i) => {
                flattenFilters(item, `${prefix}[${key}][${i}]`, parts);
            });
        }
        else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const ops = value;
            for (const [op, opVal] of Object.entries(ops)) {
                if (Array.isArray(opVal)) {
                    opVal.forEach((v, i) => {
                        parts.push(`${prefix}[${encodeURIComponent(key)}][${op}][${i}]=${encodeURIComponent(String(v))}`);
                    });
                }
                else {
                    parts.push(`${prefix}[${encodeURIComponent(key)}][${op}]=${encodeURIComponent(String(opVal))}`);
                }
            }
        }
        else {
            // Shorthand: filters[field]=value  →  filters[field][$eq]=value
            parts.push(`${prefix}[${encodeURIComponent(key)}][$eq]=${encodeURIComponent(String(value))}`);
        }
    }
}
