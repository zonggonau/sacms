import type { SaCMSConfig, FindManyParams, FindSingleParams, CollectionResponse, SingleResponse, GraphQLResponse, MutateParams } from "./types";
import type { SaCMSRegistry } from "./generated-types";
export declare class SaCMS {
    private baseUrl;
    private tenant;
    private token;
    private defaultLocale?;
    constructor(config: SaCMSConfig);
    /**
     * Access a collection content type for querying or mutating entries.
     */
    collection<K extends keyof SaCMSRegistry["collections"]>(slug: K): CollectionClient<SaCMSRegistry["collections"][K]>;
    collection<T = Record<string, unknown>>(slug: string): CollectionClient<T>;
    /**
     * Access a single type for querying its content.
     */
    single<K extends keyof SaCMSRegistry["singles"]>(slug: K): SingleClient<SaCMSRegistry["singles"][K]>;
    single<T = Record<string, unknown>>(slug: string): SingleClient<T>;
    /**
     * Execute a raw GraphQL query or mutation.
     */
    graphql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>>;
    /** @internal */
    request<T>(path: string, init?: RequestInit): Promise<T>;
    /** @internal */
    getDefaultLocale(): string | undefined;
    /** @internal */
    getTenant(): string;
}
declare class CollectionClient<T> {
    private cf;
    private slug;
    constructor(cf: SaCMS, slug: string);
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
    constructor(cf: SaCMS, slug: string);
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
export {};
