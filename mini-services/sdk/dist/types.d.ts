/** Filter operators supported by the SaCMS API */
export interface FilterOperators {
    $eq?: string | number | boolean;
    $ne?: string | number | boolean;
    $gt?: string | number;
    $gte?: string | number;
    $lt?: string | number;
    $lte?: string | number;
    $contains?: string;
    $startsWith?: string;
    $endsWith?: string;
    $in?: (string | number)[];
    $notIn?: (string | number)[];
    $null?: boolean;
    $notNull?: boolean;
}
export type Filters = Record<string, FilterOperators | string | number | boolean> & {
    $or?: Filters[];
    $and?: Filters[];
};
export interface PaginationParams {
    page?: number;
    pageSize?: number;
}
export interface FindManyParams {
    filters?: Filters;
    fields?: string[];
    populate?: string[];
    locale?: string;
    sort?: string;
    pagination?: PaginationParams;
    search?: string;
    status?: string;
}
export interface FindSingleParams {
    locale?: string;
}
export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export interface CollectionResponse<T = Record<string, unknown>> {
    data: T[];
    meta: {
        contentType: {
            name: string;
            slug: string;
        };
        pagination: PaginationMeta;
    };
}
export interface SingleResponse<T = Record<string, unknown>> {
    data: T;
    meta: {
        singleType: {
            name: string;
            slug: string;
        };
        locale: string;
    };
}
export interface GraphQLResponse<T = Record<string, unknown>> {
    data: T;
    errors?: Array<{
        message: string;
        locations?: unknown[];
        path?: string[];
    }>;
}
export interface SaCMSConfig {
    baseUrl: string;
    tenant: string;
    /**
     * Optional — the public Content API works anonymously for published
     * content (confirmed: `resolvePublicApiActor` falls back to a "public"
     * role when no Authorization header is sent at all). Only needed for a
     * full-access/read-only API token, or to read non-PUBLISHED content.
     * Omit it rather than passing `""` as a workaround — both are now
     * treated identically (see the client's own request() comment for why
     * that distinction used to matter).
     */
    token?: string;
    locale?: string;
}
export interface MutateParams {
    data: Record<string, unknown>;
    locale?: string;
    status?: string;
}
