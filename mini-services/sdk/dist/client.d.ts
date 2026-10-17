import type { SaCMSConfig, FindManyParams, FindSingleParams, CollectionResponse, SingleResponse, GraphQLResponse, MutateParams } from "./types";
import type { EmptyRegistry, SaCMSRegistryShape } from "./generated-types";
import { AuthClient } from "./auth";
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
export declare class SaCMS<Registry extends SaCMSRegistryShape = EmptyRegistry> {
    private baseUrl;
    private tenant;
    private token;
    private defaultLocale?;
    /** Member (end-user) authentication — login, register, session, profile. */
    readonly auth: AuthClient;
    constructor(config: SaCMSConfig);
    /**
     * Access a collection content type for querying or mutating entries.
     */
    collection<K extends keyof Registry["collections"]>(slug: K): CollectionClient<Registry["collections"][K]>;
    collection<T = Record<string, unknown>>(slug: string): CollectionClient<T>;
    /**
     * Access a single type for querying its content.
     */
    single<K extends keyof Registry["singles"]>(slug: K): SingleClient<Registry["singles"][K]>;
    single<T = Record<string, unknown>>(slug: string): SingleClient<T>;
    /**
     * Execute a raw GraphQL query or mutation.
     */
    graphql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>>;
    /** @internal */
    request<T>(path: string, init?: RequestInit, retries?: number): Promise<T>;
    /** @internal */
    getDefaultLocale(): string | undefined;
    /** @internal */
    getTenant(): string;
}
declare class CollectionClient<T> {
    private cf;
    private slug;
    constructor(cf: SaCMS<any>, slug: string);
    /**
     * Start a fluent query builder chain.
     */
    query(): QueryBuilder<T>;
    /**
     * Query multiple entries with filtering, sorting, pagination, and field selection.
     */
    findMany(params?: FindManyParams): Promise<CollectionResponse<T>>;
    /**
     * Get a single entry by ID.
     */
    findOne(id: string): Promise<{
        data: T;
    }>;
    /**
     * Create a new entry (requires full-access token).
     */
    create(params: MutateParams): Promise<{
        data: T;
    }>;
    /**
     * Update an entry by ID (requires full-access token).
     */
    update(id: string, params: MutateParams): Promise<{
        data: T;
    }>;
    /**
     * Delete an entry by ID (requires full-access token).
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
}
declare class SingleClient<T> {
    private cf;
    private slug;
    constructor(cf: SaCMS<any>, slug: string);
    /**
     * Get the single type content.
     */
    find(params?: FindSingleParams): Promise<SingleResponse<T>>;
    /**
     * Update the single type content (requires full-access token).
     */
    update(data: Record<string, unknown>): Promise<SingleResponse<T>>;
}
export declare class SaCMSError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export declare class QueryBuilder<T> {
    private client;
    private params;
    constructor(client: CollectionClient<T>);
    /**
     * Filter data. E.g. .where('status', 'eq', 'PUBLISHED')
     */
    where(field: string, operator: string, value: any): this;
    /**
     * Select specific fields to return. E.g. .select(['title', 'slug', 'cover'])
     */
    select(fields: string[]): this;
    /**
     * Select specific relations to populate. E.g. .populate(['author'])
     */
    populate(fields: string[]): this;
    /**
     * Sort results. E.g. .sort('createdAt:desc') or .sort('title:asc')
     */
    sort(sortOrder: string): this;
    /**
     * Full-text search across content entries. E.g. .search('nextjs tutorial')
     */
    search(query: string): this;
    /**
     * Target a specific locale. E.g. .locale('id') or .locale('en')
     */
    locale(loc: string): this;
    /**
     * Filter by status. E.g. .status('PUBLISHED') or .status('DRAFT')
     */
    status(st: string): this;
    /**
     * Limit the number of returned entries.
     */
    limit(pageSize: number): this;
    /**
     * Skip a number of pages.
     */
    page(pageNumber: number): this;
    /**
     * Execute the query and fetch the results.
     */
    fetch(): Promise<CollectionResponse<T>>;
}
export {};
