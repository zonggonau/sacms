/**
 * Builds a real OpenAPI 3.0 document from a tenant's already-fetched CMS
 * schema — the exact field-mapping and path-building logic that used to
 * live only in `developer/openapi/route.ts` (the dashboard's Swagger tab),
 * extracted so it has one source of truth across three callers: that
 * dashboard route, the public `GET /api/public/[tenant]/openapi.json`
 * endpoint, and the MCP server's `get_openapi_spec` tool. Deliberately a
 * pure function — no Prisma access here — since each caller's own query
 * for "which content/single types" differs slightly (the dashboard route
 * includes global platform-adjacent types with EXCLUDE_PLATFORM_CONTENT_TYPES
 * applied; a public caller should match whatever `/api/public/.../content`
 * itself actually serves), so fetching stays each call site's own job.
 */

export interface OpenApiSchemaField {
  slug: string
  name: string
  type: string
  required?: boolean | null
}

export interface OpenApiModel {
  slug: string
  name: string
  fields: OpenApiSchemaField[]
}

function toPascalCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

// Matches the field-shaping the actual public API routes apply — kept
// intentionally simple (string/number/boolean/object) since the real
// response types for richer field types (media, relation, component, …)
// vary by what's populated; this is a close JSON-Schema approximation, not
// a byte-exact contract.
function fieldSchema(field: OpenApiSchemaField): Record<string, unknown> {
  let type: string = "string"
  if (field.type === "number" || field.type === "currency" || field.type === "percent" || field.type === "rating") type = "number"
  if (field.type === "boolean") type = "boolean"
  if (field.type === "json" || field.type === "component" || field.type === "media" || field.type === "location" || field.type === "seo" || field.type === "button" || field.type === "file" || field.type === "dateRange") type = "object"
  if (field.type === "mediaMultiple" || field.type === "multiselect" || field.type === "tags" || field.type === "repeater") type = "array"

  return {
    type,
    description: field.name,
    ...(field.required ? { nullable: false } : { nullable: true }),
  }
}

const COLLECTION_QUERY_PARAMS = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number (also accepted as pagination[page])." },
  { name: "pageSize", in: "query", schema: { type: "integer", default: 25, maximum: 100 }, description: "Entries per page, max 100 (also accepted as pagination[pageSize])." },
  { name: "sort", in: "query", schema: { type: "string", default: "createdAt:desc" }, description: "Field and direction, e.g. publishedAt:desc." },
  { name: "fields", in: "query", schema: { type: "string" }, description: "Comma-separated field slugs to return, e.g. title,slug." },
  { name: "populate", in: "query", schema: { type: "string" }, description: "Comma-separated relation field slugs to expand, or * for all." },
  { name: "locale", in: "query", schema: { type: "string" }, description: "Locale code to fetch, e.g. id or en." },
  { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }, description: "Filter by status — only honoured for full-access tokens; other callers always get PUBLISHED only." },
  { name: "search", in: "query", schema: { type: "string" }, description: "Full-text search across text fields." },
  { name: "filters", in: "query", schema: { type: "string" }, description: "Bracket-syntax field filters, e.g. filters[title][$eq]=Tutorial — see the REST Explorer's Parameter & Filter Cheat Sheet for the full operator list ($eq, $ne, $gt, $gte, $lt, $lte, $in, $notIn, $contains)." },
]

export function buildOpenApiSpec(options: {
  tenantName: string
  tenantSlug: string
  apiOrigin: string
  contentTypes: OpenApiModel[]
  singleTypes: OpenApiModel[]
}): Record<string, unknown> {
  const { tenantName, tenantSlug, apiOrigin, contentTypes, singleTypes } = options
  const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${tenantSlug}`

  const schemas: Record<string, unknown> = {}
  const paths: Record<string, unknown> = {}

  for (const ct of contentTypes) {
    const schemaName = toPascalCase(ct.slug)
    const customFieldProps: Record<string, unknown> = {}
    for (const f of ct.fields) customFieldProps[f.slug] = fieldSchema(f)

    // Entry shape: custom fields spread flat alongside the base fields —
    // the real response never nests them under a sub-object. See the
    // entry-shaping code in content/[contentType]/route.ts (list) and its
    // [id]/route.ts (single entry).
    schemas[schemaName] = {
      type: "object",
      properties: {
        id: { type: "string" },
        documentId: { type: "string" },
        locale: { type: "string" },
        availableLocales: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
        publishedAt: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        ...customFieldProps,
      },
    }

    // Input schema for create/update — only the caller-supplied custom
    // fields; id/status/timestamps are always server-generated.
    schemas[`${schemaName}Input`] = { type: "object", properties: customFieldProps }

    paths[`/content/${ct.slug}`] = {
      get: {
        summary: `List all ${ct.name} entries`,
        tags: ["Collection Types"],
        parameters: COLLECTION_QUERY_PARAMS,
        responses: {
          "200": {
            description: "Paginated list of entries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: `#/components/schemas/${schemaName}` } },
                    meta: {
                      type: "object",
                      properties: {
                        contentType: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" } } },
                        pagination: {
                          type: "object",
                          properties: {
                            page: { type: "integer" },
                            pageSize: { type: "integer" },
                            total: { type: "integer" },
                            totalPages: { type: "integer" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: `Create a new ${ct.name} (always created as DRAFT)`,
        tags: ["Collection Types"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: { $ref: `#/components/schemas/${schemaName}Input` }, locale: { type: "string", nullable: true } },
                required: ["data"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } },
          },
        },
      },
    }

    paths[`/content/${ct.slug}/{id}`] = {
      get: {
        summary: `Get a specific ${ct.name} by ID or documentId`,
        tags: ["Collection Types"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "fields", in: "query", schema: { type: "string" } },
          { name: "populate", in: "query", schema: { type: "string" } },
          { name: "locale", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } },
          },
        },
      },
      put: {
        summary: `Update a ${ct.name} entry (status is unchanged by this call)`,
        tags: ["Collection Types"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}Input` } }, required: ["data"] },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } },
          },
        },
      },
      delete: {
        summary: `Delete a ${ct.name} entry`,
        tags: ["Collection Types"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { type: "object", properties: { data: { type: "object", properties: { id: { type: "string" }, deleted: { type: "boolean" } } } } },
              },
            },
          },
        },
      },
    }
  }

  for (const st of singleTypes) {
    const schemaName = `${toPascalCase(st.slug)}Single`
    const customFieldProps: Record<string, unknown> = {}
    for (const f of st.fields) customFieldProps[f.slug] = fieldSchema(f)

    schemas[schemaName] = {
      type: "object",
      properties: {
        publishedAt: { type: "string", format: "date-time", nullable: true },
        updatedAt: { type: "string", format: "date-time" },
        ...customFieldProps,
      },
    }

    paths[`/single/${st.slug}`] = {
      get: {
        summary: `Get ${st.name} data`,
        tags: ["Single Types"],
        parameters: [{ name: "locale", in: "query", schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } },
          },
        },
      },
      put: {
        summary: `Update ${st.name} data`,
        tags: ["Single Types"],
        parameters: [{ name: "locale", in: "query", schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "object", properties: customFieldProps },
                  publish: { type: "boolean", description: "Set publishedAt to now when true." },
                },
                required: ["data"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } },
          },
        },
      },
    }
  }

  paths["/graphql"] = {
    post: {
      summary: "Dynamic GraphQL endpoint — fields mirror the REST schemas above",
      tags: ["GraphQL"],
      requestBody: {
        content: {
          "application/json": {
            schema: { type: "object", properties: { query: { type: "string" }, variables: { type: "object" } }, required: ["query"] },
          },
        },
      },
      responses: { "200": { description: "OK" } },
    },
  }

  return {
    openapi: "3.0.0",
    info: {
      title: `API Documentation - ${tenantName}`,
      description: `Dynamic API documentation for ${tenantName} workspace generated by SaCMS.`,
      version: "1.0.0",
    },
    servers: [{ url: apiBase, description: "Public API Gateway" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Your workspace API Key, e.g. cf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.",
        },
      },
      schemas,
    },
    security: [{ BearerAuth: [] }],
    paths,
  }
}
