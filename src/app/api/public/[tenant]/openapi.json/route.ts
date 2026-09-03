import { NextRequest, NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"

// ─── CORS Helper ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, X-API-Key",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    if (!tenantSlug) {
      return NextResponse.json({ error: "Tenant identifier required" }, { status: 400, headers: CORS_HEADERS })
    }

    // Resolve tenant by slug or ID
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { id: tenantSlug }
        ]
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Workspace tenant not found" }, { status: 404, headers: CORS_HEADERS })
    }

    // Get tenant database (support hybrid multi-tenancy & shared pool)
    const tenantDb = await getTenantDb(tenant.slug)

    // Fetch Content Types, Single Types, and Components
    const [contentTypes, singleTypes] = await Promise.all([
      tenantDb.contentType.findMany({
        where: { tenantId: tenant.id },
        include: { schemaFields: { orderBy: { order: "asc" } } },
        orderBy: { name: "asc" }
      }),
      tenantDb.singleType.findMany({
        where: { tenantId: tenant.id },
        include: { schemaFields: { orderBy: { order: "asc" } } },
        orderBy: { name: "asc" }
      })
    ])

    // Determine Base URL
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
    const hostBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : (process.env.NEXTAUTH_URL || "http://localhost:3000")
    const serverUrl = `${hostBase}/api/public/${tenant.slug}`

    // ─── Build OpenAPI 3.1.0 Specification ───────────────────────────────────

    const spec: any = {
      openapi: "3.1.0",
      info: {
        title: `${tenant.name} — Headless CMS API`,
        description: `Dynamic REST API and Action Specification for **${tenant.name}** powered by SaCMS.\n\nUse this specification to connect ChatGPT Custom GPTs, Google AI Studio, Manus, Emergent, and other AI agents to manage CMS content.\n\n### Authentication\nProvide your API token or API key using standard HTTP Bearer authorization:\n\`Authorization: Bearer <YOUR_API_TOKEN>\`\nor header \`x-api-key: <YOUR_API_KEY>\`.`,
        version: "1.0.0",
      },
      servers: [
        {
          url: serverUrl,
          description: `Primary Public API Gateway for ${tenant.name}`,
        },
      ],
      security: [
        { BearerAuth: [] },
        { ApiKeyAuth: [] },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API Token",
            description: "SaCMS API Token or Workspace Bearer Token",
          },
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "SaCMS API Key Header",
          },
        },
        schemas: {
          ErrorResponse: {
            type: "object",
            properties: {
              error: { type: "string", description: "Error message details" },
            },
          },
          PaginationMetadata: {
            type: "object",
            properties: {
              page: { type: "integer", example: 1 },
              pageSize: { type: "integer", example: 25 },
              pageCount: { type: "integer", example: 4 },
              total: { type: "integer", example: 85 },
            },
          },
        },
      },
      paths: {} as Record<string, any>,
    }

    // ─── 1. Content Types Endpoints (Collections) ────────────────────────────

    contentTypes.forEach((ct) => {
      const typeName = ct.slug.replace(/[^a-zA-Z0-9]/g, "")
      const schemaName = `${typeName.charAt(0).toUpperCase() + typeName.slice(1)}Entry`
      const inputSchemaName = `${typeName.charAt(0).toUpperCase() + typeName.slice(1)}Input`

      // Build field properties
      const fieldProperties: Record<string, any> = {}
      const requiredFields: string[] = []

      ct.schemaFields.forEach((f) => {
        let fieldType: string = "string"
        let format: string | undefined = undefined

        switch (f.type) {
          case "number":
            fieldType = "number"
            break
          case "boolean":
            fieldType = "boolean"
            break
          case "date":
            fieldType = "string"
            format = "date-time"
            break
          case "json":
          case "component":
            fieldType = "object"
            break
          default:
            fieldType = "string"
        }

        fieldProperties[f.slug] = {
          type: fieldType,
          description: f.name,
          ...(format ? { format } : {}),
        }

        if (f.required) {
          requiredFields.push(f.slug)
        }
      })

      // Register Input & Entry schemas
      spec.components.schemas[inputSchemaName] = {
        type: "object",
        description: `Input payload for creating or updating a ${ct.name} entry`,
        properties: fieldProperties,
        ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
      }

      spec.components.schemas[schemaName] = {
        type: "object",
        description: `${ct.name} content entry with metadata`,
        properties: {
          id: { type: "string", description: "Unique entry ID" },
          status: {
            type: "string",
            enum: ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED", "REJECTED"],
            example: "PUBLISHED",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          locale: { type: "string", example: "id" },
          ...fieldProperties,
        },
      }

      // Path: /content/{contentType}
      spec.paths[`/content/${ct.slug}`] = {
        get: {
          summary: `List ${ct.name} entries`,
          description: `Fetch published or draft ${ct.name} entries with Strapi-style filtering, search, pagination, and sorting.`,
          operationId: `list${schemaName}s`,
          tags: ["Collection Types"],
          parameters: [
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Search keyword matching text and string fields",
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"],
                default: "PUBLISHED",
              },
              description: "Content status filter (defaults to PUBLISHED only for public API)",
            },
            {
              name: "pagination[page]",
              in: "query",
              required: false,
              schema: { type: "integer", default: 1 },
              description: "Page number (1-indexed)",
            },
            {
              name: "pagination[pageSize]",
              in: "query",
              required: false,
              schema: { type: "integer", default: 25, maximum: 100 },
              description: "Number of records per page (max 100)",
            },
            {
              name: "sort",
              in: "query",
              required: false,
              schema: { type: "string", example: "createdAt:desc" },
              description: "Sort format: fieldName:asc or fieldName:desc",
            },
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", example: "id" },
              description: "Content localization language code",
            },
            {
              name: "populate",
              in: "query",
              required: false,
              schema: { type: "string", example: "*" },
              description: "Relations or media to populate ('*' for all)",
            },
          ],
          responses: {
            "200": {
              description: `Successfully retrieved list of ${ct.name} entries.`,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: `#/components/schemas/${schemaName}` },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          pagination: { $ref: "#/components/schemas/PaginationMetadata" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized or missing API token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          summary: `Create new ${ct.name} entry`,
          description: `Create and optionally publish a new ${ct.name} entry.`,
          operationId: `create${schemaName}`,
          tags: ["Collection Types"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${inputSchemaName}` },
                    status: {
                      type: "string",
                      enum: ["DRAFT", "PUBLISHED", "IN_REVIEW"],
                      default: "PUBLISHED",
                    },
                    locale: { type: "string", default: "id" },
                  },
                  required: ["data"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: `${ct.name} entry created successfully.`,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: `#/components/schemas/${schemaName}` },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid field values or payload format" },
            "401": { description: "Unauthorized" },
          },
        },
      }

      // Path: /content/{contentType}/{id}
      spec.paths[`/content/${ct.slug}/{id}`] = {
        get: {
          summary: `Get single ${ct.name} entry`,
          description: `Fetch a specific ${ct.name} entry by ID.`,
          operationId: `get${schemaName}ById`,
          tags: ["Collection Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "The unique ID of the content entry",
            },
            {
              name: "populate",
              in: "query",
              required: false,
              schema: { type: "string", example: "*" },
              description: "Relations to expand",
            },
          ],
          responses: {
            "200": {
              description: "Entry details.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: `#/components/schemas/${schemaName}` },
                    },
                  },
                },
              },
            },
            "404": { description: "Entry not found" },
          },
        },
        put: {
          summary: `Update ${ct.name} entry`,
          description: `Update the field values or status of an existing ${ct.name} entry.`,
          operationId: `update${schemaName}ById`,
          tags: ["Collection Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "The unique ID of the content entry",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${inputSchemaName}` },
                    status: {
                      type: "string",
                      enum: ["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Entry updated successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: `#/components/schemas/${schemaName}` },
                    },
                  },
                },
              },
            },
            "404": { description: "Entry not found" },
          },
        },
        delete: {
          summary: `Delete ${ct.name} entry`,
          description: `Permanently delete a ${ct.name} entry by ID.`,
          operationId: `delete${schemaName}ById`,
          tags: ["Collection Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "The unique ID of the content entry to delete",
            },
          ],
          responses: {
            "200": {
              description: "Entry deleted successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      message: { type: "string", example: "Entry deleted successfully" },
                    },
                  },
                },
              },
            },
            "404": { description: "Entry not found" },
          },
        },
      }
    })

    // ─── 2. Single Types Endpoints (Singleton Pages) ─────────────────────────

    singleTypes.forEach((st) => {
      const typeName = st.slug.replace(/[^a-zA-Z0-9]/g, "")
      const schemaName = `${typeName.charAt(0).toUpperCase() + typeName.slice(1)}Single`

      const fieldProps: Record<string, any> = {}
      st.schemaFields.forEach((f) => {
        fieldProps[f.slug] = {
          type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : f.type === "json" ? "object" : "string",
          description: f.name,
        }
      })

      spec.components.schemas[schemaName] = {
        type: "object",
        description: `Singleton data for ${st.name}`,
        properties: fieldProps,
      }

      spec.paths[`/single/${st.slug}`] = {
        get: {
          summary: `Get ${st.name} data`,
          description: `Fetch singleton page content for ${st.name}.`,
          operationId: `get${schemaName}`,
          tags: ["Single Types"],
          parameters: [
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", default: "id" },
              description: "Content locale",
            },
          ],
          responses: {
            "200": {
              description: `Retrieved ${st.name} content data.`,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: `#/components/schemas/${schemaName}` },
                      meta: {
                        type: "object",
                        properties: {
                          singleType: { type: "string", example: st.slug },
                          locale: { type: "string", example: "id" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "404": { description: "Single type not found" },
          },
        },
        put: {
          summary: `Update ${st.name} data`,
          description: `Save and publish singleton data for ${st.name}.`,
          operationId: `update${schemaName}`,
          tags: ["Single Types"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    locale: { type: "string", default: "id" },
                  },
                  required: ["data"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Single type updated successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: `#/components/schemas/${schemaName}` },
                    },
                  },
                },
              },
            },
          },
        },
      }
    })

    // ─── 3. Brand & General Endpoints ────────────────────────────────────────

    spec.paths["/brand"] = {
      get: {
        summary: "Get Workspace White-Label Brand Info",
        description: "Fetch public branding assets, site logo, brand name, and color scheme.",
        operationId: "getWorkspaceBrand",
        tags: ["Workspace"],
        responses: {
          "200": {
            description: "Branding information.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", example: tenant.name },
                    slug: { type: "string", example: tenant.slug },
                    logoUrl: { type: "string", nullable: true },
                    primaryColor: { type: "string", example: "#4f46e5" },
                  },
                },
              },
            },
          },
        },
      },
    }

    return new NextResponse(JSON.stringify(spec, null, 2), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch (error: any) {
    console.error("OpenAPI Spec Generation Error:", error)
    return NextResponse.json(
      { error: "Failed to generate OpenAPI specification" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
