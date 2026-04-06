"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaCMSError = exports.SaCMS = void 0;
class SaCMS {
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.tenant = config.tenant;
        this.token = config.token;
        this.defaultLocale = config.locale;
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
    async request(path, init) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            ...init?.headers,
        };
        const res = await fetch(url, { ...init, headers });
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
