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
        this.token = config.token ?? "";
        // Sixth external audit: unset before, a hung connection to the server
        // could block a page's render indefinitely — 15s is generous enough
        // not to false-positive on a slow connection, short enough to not
        // hang a request forever. Override per-client via `timeoutMs`, or
        // per-call via `RequestExtras.timeoutMs` (0 disables it for that call).
        this.defaultTimeoutMs = config.timeoutMs ?? 15000;
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
    async graphql(query, variables, extras) {
        return this.request(`/api/public/${this.tenant}/graphql`, {
            method: "POST",
            body: JSON.stringify({ query, variables }),
        }, extras);
    }
    /** @internal */
    async request(path, init = {}, extras = {}, retries = 3) {
        const url = `${this.baseUrl}${path}`;
        // Sixth external audit: retrying a NETWORK failure (connection reset,
        // DNS, timeout — as opposed to a 429, which means the server never
        // processed the request at all) is only safe for a method with no
        // side effects. A dropped connection on POST/PUT/DELETE leaves real
        // ambiguity about whether the server already wrote the data before
        // the connection died — blindly retrying those risked a duplicate
        // write, confirmed as a real finding. Only GET is retried on a raw
        // network failure; a 429 is still retried for every method (it means
        // the request was rejected before any processing happened at all).
        const method = (init.method || "GET").toUpperCase();
        const isIdempotentMethod = method === "GET";
        const headers = {
            // Sixth external audit: this used to always send Content-Type:
            // application/json, including on a GET/DELETE with no body — a
            // non-empty, non-form Content-Type on a cross-origin request forces
            // the browser into an extra CORS preflight (OPTIONS) round-trip for
            // every single read, for no reason (there's no body to describe).
            ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
            // Fifth external audit: this used to send `Authorization: Bearer
            // ${this.token}` unconditionally — with no token configured,
            // `this.token` was `undefined` (TS's `token: string` only enforces
            // this at compile time; a plain-JS caller omitting it entirely got
            // a real `undefined` at runtime), producing the literal header
            // "Bearer undefined". The server's own bearer-extraction only treats
            // a MISSING Authorization header as anonymous/public access — a
            // non-empty (but garbage) token value is treated as a real,
            // invalid credential attempt and rejected with 401, even though the
            // request would have succeeded perfectly well anonymously had this
            // header been omitted entirely. Only send it when a real token exists.
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...init.headers,
            ...extras.headers,
        };
        const timeoutMs = extras.timeoutMs ?? this.defaultTimeoutMs;
        const callerSignal = extras.signal ?? init.signal;
        for (let attempt = 0; attempt <= retries; attempt++) {
            // Sixth external audit: there was no timeout at all before — a
            // request the server never answers could hang a page's render
            // forever. Only installed when the caller didn't bring their own
            // `signal` (composing two AbortSignals isn't universally supported
            // across the runtimes this SDK targets — a caller-supplied signal
            // takes full responsibility for abort instead).
            let timeoutController;
            let timeoutHandle;
            let signal = callerSignal;
            if (!callerSignal && timeoutMs > 0) {
                timeoutController = new AbortController();
                signal = timeoutController.signal;
                timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
            }
            try {
                const fetchInit = { ...init, headers, signal };
                if (extras.next)
                    fetchInit.next = extras.next;
                if (extras.cache)
                    fetchInit.cache = extras.cache;
                // Seventh external audit: the timeout used to be cleared as soon
                // as fetch() itself resolved — which the Fetch spec defines as
                // "headers received," NOT "body fully read." A server sending
                // headers immediately but trickling the body over several seconds
                // sailed straight through a short timeoutMs with nothing enforcing
                // it, because clearTimeout had already fired before res.json()/
                // res.text() even started. The same AbortSignal passed into
                // fetch() already governs the body-read stream too (standard,
                // well-supported Fetch behavior) — the fix is simply to keep the
                // timer running (and the try/catch covering it) through the body
                // read as well, not to invent new cancellation plumbing.
                const res = await fetch(url, fetchInit);
                if (res.status === 429 && attempt < retries) {
                    // `finally` below clears timeoutHandle before this `continue`
                    // actually advances the loop — no need to do it here too.
                    const delay = parseRetryAfterMs(res.headers.get("Retry-After")) ?? 1000 * Math.pow(2, attempt);
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
                    // A real, successfully-received HTTP error response — not a
                    // network/abort failure — so it must propagate as-is, never
                    // treated as something to retry below.
                    throw new SaCMSError(message, res.status);
                }
                return (await res.json());
            }
            catch (err) {
                if (err instanceof SaCMSError)
                    throw err;
                // Seventh external audit: a caller who passed their OWN `signal`
                // and aborted it got retried anyway (up to ~7s of backoff) before
                // finally surfacing their cancellation — a caller-initiated abort
                // must fail immediately, the same way a deliberate timeout
                // already did, regardless of method.
                if (callerSignal?.aborted) {
                    throw new SaCMSError(`Request to ${path} was aborted by the caller`, 0);
                }
                // A timeout is deliberate (OUR OWN AbortController, not the
                // caller's) — fail immediately rather than retrying it. Retrying
                // with exponential backoff on top of a timeout the caller chose
                // specifically to fail FAST would silently balloon the effective
                // wait time well past what they configured, defeating the point
                // of a short timeoutMs override.
                if (!callerSignal && err instanceof Error && err.name === "AbortError") {
                    throw new SaCMSError(`Request to ${path} timed out after ${timeoutMs}ms`, 0);
                }
                if (isIdempotentMethod && attempt < retries) {
                    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
                    continue;
                }
                // A pure network failure (connection reset, DNS) throws before
                // there's any Response to inspect — surfaced as a typed
                // SaCMSError instead of a raw, un-typed exception the README's
                // `catch (SaCMSError)` pattern can't catch.
                throw new SaCMSError(err instanceof Error ? err.message : "Network request failed", 0);
            }
            finally {
                if (timeoutHandle)
                    clearTimeout(timeoutHandle);
            }
        }
        throw new SaCMSError("Max retries reached", 429);
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
    async findMany(params, extras) {
        const qs = buildQueryString(params);
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}${qs}`, {}, extras);
    }
    /**
     * Get a single entry by ID. Pass `populate` the same way you
     * would to `findMany` — omitted, a relation field comes back as a raw id.
     */
    async findOne(id, params, extras) {
        const qsParts = [];
        if (params?.populate) {
            const populateValue = params.populate === "*" ? "*" : params.populate.map(encodeURIComponent).join(",");
            qsParts.push(`populate=${populateValue}`);
        }
        const qs = qsParts.length ? `?${qsParts.join("&")}` : "";
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}${qs}`, {}, extras);
    }
    /**
     * Create a new entry (requires full-access token).
     */
    async create(params, extras) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}`, {
            method: "POST",
            body: JSON.stringify({
                data: params.data,
                status: params.status,
            }),
        }, extras);
    }
    /**
     * Update an entry by ID (requires full-access token).
     */
    async update(id, params, extras) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
                data: params.data,
                status: params.status,
            }),
        }, extras);
    }
    /**
     * Delete an entry by ID (requires full-access token).
     */
    async delete(id, extras) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/content/${this.slug}/${encodeURIComponent(id)}`, { method: "DELETE" }, extras);
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
    async find(extras) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/single/${this.slug}`, {}, extras);
    }
    /**
     * Update the single type content (requires full-access token).
     */
    async update(data, extras) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/single/${this.slug}`, {
            method: "PUT",
            body: JSON.stringify({ data }),
        }, extras);
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
     * Select specific relations to populate. E.g. .populate(['author']) or .populate('*') for every relation.
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
    async fetch(extras) {
        return this.client.findMany(this.params, extras);
    }
}
exports.QueryBuilder = QueryBuilder;
// ─── Helpers ────────────────────────────────────────────
/**
 * Sixth external audit: `Retry-After` is valid as EITHER delta-seconds
 * (what this used to assume exclusively) OR an HTTP-date (RFC 9110 §10.2.3)
 * — the server is free to send either. `parseInt("<http-date>", 10)` on
 * the date form returns `NaN` (it parses the leading digits of the day-of-
 * month, if any, then gives up), silently losing the intended backoff
 * delay entirely (`setTimeout` treats a NaN delay as 0, i.e. an immediate
 * retry with no backoff at all).
 */
function parseRetryAfterMs(header) {
    if (!header)
        return null;
    const seconds = Number(header);
    if (!Number.isNaN(seconds))
        return Math.max(0, seconds * 1000);
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs))
        return Math.max(0, dateMs - Date.now());
    return null;
}
function buildQueryString(params) {
    if (!params)
        return "";
    const parts = [];
    if (params.filters) {
        flattenFilters(params.filters, "filters", parts);
    }
    if (params.fields?.length) {
        parts.push(`fields=${params.fields.map(encodeURIComponent).join(",")}`);
    }
    // Seventh external audit: `params.populate?.length` is truthy for the
    // STRING "*" too (strings have `.length`), so this used to fall through
    // to `.map()` — not a method strings have — and crash with a raw
    // TypeError instead of building `populate=*`. findOne() already handled
    // the "*" case correctly; made findMany() match it.
    if (params.populate === "*") {
        parts.push("populate=*");
    }
    else if (params.populate?.length) {
        parts.push(`populate=${params.populate.map(encodeURIComponent).join(",")}`);
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
