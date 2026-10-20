/**
 * Builds a real OpenAPI 3.1 document from a tenant's already-fetched CMS
 * schema — one source of truth for three callers: the dashboard's Swagger
 * tab (`developer/openapi`), the public `GET /api/public/[tenant]/
 * openapi.json` endpoint, and the MCP server's `get_openapi_spec` tool.
 *
 * History worth knowing before touching this again: this reconciles THREE
 * independently-written generators that existed in this codebase at once —
 * the dashboard route's (correct entry shape, incomplete status enum,
 * missing CORS/dual-auth/brand endpoint, tenant-only Content Types) and the
 * public route's (correct status enum, CORS, dual auth scheme, a /brand
 * endpoint, but ALSO tenant-only Content Types and weaker field-type
 * mapping). Confirmed live against production (`curl .../openapi.json`)
 * that the public route's version was the one actually shipped and in use
 * — don't trust a route's presence in a fresh git checkout without
 * `git log --all -- <path>` first; a file that looks new to a local
 * session may already have real history and callers.
 *
 * Deliberately a pure function — no Prisma access — since each caller's
 * own query for "which content/single types" differs slightly (tenant-only
 * vs tenant+global minus SaCMS's internal platform types), so fetching
 * stays each call site's own job.
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
  const cleaned = slug.replace(/[^a-zA-Z0-9]/g, " ")
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

// Close JSON-Schema approximation of SaCMS's 33 field types
// (src/lib/field-types.ts) — not a byte-exact contract (e.g. populated
// relations/media vary in shape), but close enough for codegen/discovery.
// Anything not listed falls back to a plain string rather than throwing.
function fieldSchema(field: OpenApiSchemaField): Record<string, unknown> {
  let schema: Record<string, unknown>
  switch (field.type) {
    case "number":
    case "currency":
    case "percent":
    case "rating":
      schema = { type: "number" }
      break
    case "boolean":
      schema = { type: "boolean" }
      break
    case "date":
      schema = { type: "string", format: "date" }
      break
    case "datetime":
      schema = { type: "string", format: "date-time" }
      break
    case "email":
      schema = { type: "string", format: "email" }
      break
    case "url":
      schema = { type: "string", format: "uri" }
      break
    case "json":
    case "component":
    case "media":
    case "file":
    case "location":
    case "seo":
    case "button":
    case "dateRange":
      schema = { type: "object" }
      break
    case "mediaMultiple":
    case "multiselect":
    case "tags":
    case "repeater":
      schema = { type: "array", items: { type: "object" } }
      break
    case "relation":
      schema = { type: "object", description: "Related entry reference" }
      break
    default:
      schema = { type: "string" }
  }
  return { ...schema, description: field.name }
}

// Real workflow states (prisma/schema.prisma's ContentStatus enum) — the
// dashboard route's own generator used to only list DRAFT/PUBLISHED/
// ARCHIVED, which under-documented what the API can actually return.
const CONTENT_STATUS_ENUM = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED", "REJECTED"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, X-API-Key",
  "Access-Control-Max-Age": "86400",
} as const

export function buildOpenApiSpec(options: {
  tenantName: string
  tenantSlug: string
  apiOrigin: string
  contentTypes: OpenApiModel[]
  singleTypes: OpenApiModel[]
}): Record<string, unknown> {
  const { tenantName, tenantSlug, apiOrigin, contentTypes, singleTypes } = options
  const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${tenantSlug}`

  const schemas: Record<string, unknown> = {
    ErrorResponse: {
      type: "object",
      properties: { error: { type: "string", description: "Error message details" } },
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
  }
  const paths: Record<string, unknown> = {}

  for (const ct of contentTypes) {
    const base = toPascalCase(ct.slug)
    const entrySchema = `${base}Entry`
    const inputSchema = `${base}Input`

    const fieldProps: Record<string, unknown> = {}
    const required: string[] = []
    for (const f of ct.fields) {
      fieldProps[f.slug] = fieldSchema(f)
      if (f.required) required.push(f.slug)
    }

    schemas[inputSchema] = {
      type: "object",
      description: `Input payload for creating or updating a ${ct.name} entry`,
      properties: fieldProps,
      ...(required.length > 0 ? { required } : {}),
    }

    // Entry shape: custom fields spread flat alongside the base fields —
    // the real response never nests them under a sub-object. See the
    // entry-shaping code in content/[contentType]/route.ts (list) and its
    // [id]/route.ts (single entry).
    schemas[entrySchema] = {
      type: "object",
      description: `${ct.name} content entry with metadata`,
      properties: {
        id: { type: "string", description: "Unique entry ID" },
        documentId: { type: "string" },
        locale: { type: "string", example: "id" },
        availableLocales: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: CONTENT_STATUS_ENUM, example: "PUBLISHED" },
        publishedAt: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        ...fieldProps,
      },
    }

    paths[`/content/${ct.slug}`] = {
      get: {
        summary: `List ${ct.name} entries`,
        description: `Fetch published or draft ${ct.name} entries with Strapi-style filtering, search, pagination, and sorting.`,
        operationId: `list${entrySchema}s`,
        tags: ["Collection Types"],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Full-text search across text fields." },
          { name: "status", in: "query", schema: { type: "string", enum: [...CONTENT_STATUS_ENUM, "ALL"], default: "PUBLISHED" }, description: "Content status filter (defaults to PUBLISHED only for public, non-write callers)." },
          { name: "pagination[page]", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pagination[pageSize]", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
          { name: "sort", in: "query", schema: { type: "string", example: "createdAt:desc" }, description: "Field and direction." },
          { name: "locale", in: "query", schema: { type: "string", example: "id" } },
          { name: "fields", in: "query", schema: { type: "string" }, description: "Comma-separated field selection, e.g. title,slug." },
          { name: "populate", in: "query", schema: { type: "string", example: "*" }, description: "Comma-separated relation fields to expand, or * for all." },
          { name: "filters", in: "query", schema: { type: "object" }, description: "Bracket-syntax field filters, e.g. filters[title][$eq]=Tutorial ($eq/$ne/$gt/$gte/$lt/$lte/$in/$notIn/$contains)." },
        ],
        responses: {
          "200": {
            description: `Successfully retrieved list of ${ct.name} entries.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: `#/components/schemas/${entrySchema}` } },
                    meta: { type: "object", properties: { pagination: { $ref: "#/components/schemas/PaginationMetadata" } } },
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
        operationId: `create${entrySchema}`,
        tags: ["Collection Types"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: `#/components/schemas/${inputSchema}` },
                  status: { type: "string", enum: ["DRAFT", "PUBLISHED", "IN_REVIEW"], default: "PUBLISHED" },
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
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${entrySchema}` } } } } },
          },
          "400": { description: "Invalid field values or payload format" },
          "401": { description: "Unauthorized" },
        },
      },
    }

    paths[`/content/${ct.slug}/{id}`] = {
      get: {
        summary: `Get single ${ct.name} entry`,
        operationId: `get${entrySchema}ById`,
        tags: ["Collection Types"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "fields", in: "query", schema: { type: "string" } },
          { name: "populate", in: "query", schema: { type: "string", example: "*" } },
          { name: "locale", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Entry details.", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${entrySchema}` } } } } } },
          "404": { description: "Entry not found" },
        },
      },
      put: {
        summary: `Update ${ct.name} entry`,
        operationId: `update${entrySchema}ById`,
        tags: ["Collection Types"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: { $ref: `#/components/schemas/${inputSchema}` }, status: { type: "string", enum: CONTENT_STATUS_ENUM } },
                required: ["data"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Entry updated successfully.", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${entrySchema}` } } } } } },
          "404": { description: "Entry not found" },
        },
      },
      delete: {
        summary: `Delete ${ct.name} entry`,
        operationId: `delete${entrySchema}ById`,
        tags: ["Collection Types"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Entry deleted successfully.",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } },
          },
          "404": { description: "Entry not found" },
        },
      },
    }
  }

  for (const st of singleTypes) {
    const schemaName = `${toPascalCase(st.slug)}Single`
    const fieldProps: Record<string, unknown> = {}
    for (const f of st.fields) fieldProps[f.slug] = fieldSchema(f)

    schemas[schemaName] = { type: "object", description: `Singleton data for ${st.name}`, properties: fieldProps }

    paths[`/single/${st.slug}`] = {
      get: {
        summary: `Get ${st.name} data`,
        operationId: `get${schemaName}`,
        tags: ["Single Types"],
        parameters: [{ name: "locale", in: "query", schema: { type: "string", default: "id" } }],
        responses: {
          "200": {
            description: `Retrieved ${st.name} content data.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    meta: { type: "object", properties: { singleType: { type: "string", example: st.slug }, locale: { type: "string", example: "id" }, updatedAt: { type: "string", format: "date-time" } } },
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
        operationId: `update${schemaName}`,
        tags: ["Single Types"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` }, locale: { type: "string", default: "id" } }, required: ["data"] },
            },
          },
        },
        responses: {
          "200": { description: "Single type updated successfully.", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: `#/components/schemas/${schemaName}` } } } } } },
        },
      },
    }
  }

  // ─── Member (end-user) auth — Strapi-parity headless auth, separate from
  // the ApiToken/ApiKey system every other path above uses. These are what
  // a fullstack app built against this workspace should call directly from
  // its own client code (register/login a visitor, refresh their session)
  // — real endpoints, read straight from each route file rather than
  // guessed, since an agent scaffolding auth UI from a wrong shape is worse
  // than no spec entry at all.
  schemas.MemberUser = {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      name: { type: "string", nullable: true },
      avatar: { type: "string", nullable: true },
      role: { type: "string", example: "authenticated" },
      status: { type: "string", enum: ["pending_verification", "active", "suspended"] },
      metadata: { type: "object" },
      createdAt: { type: "string", format: "date-time" },
      lastLoginAt: { type: "string", format: "date-time", nullable: true },
    },
  }
  schemas.MemberSessionResponse = {
    type: "object",
    properties: {
      message: { type: "string" },
      user: { $ref: "#/components/schemas/MemberUser" },
      accessToken: { type: "string", description: "Short-lived JWT — send as `Authorization: Bearer <accessToken>`." },
      refreshToken: { type: "string", description: "Opaque, long-lived — exchange at /auth/refresh for a new accessToken when it expires. Single-use: rotated on every refresh." },
      expiresIn: { type: "number", description: "accessToken lifetime in seconds" },
      tokenType: { type: "string", example: "Bearer" },
    },
  }
  // The password-recovery/confirmation endpoints below predate the
  // register/login response shape and return a flatter { jwt, refreshToken,
  // user } instead of { accessToken, expiresIn, tokenType } — kept as-is
  // here rather than normalized, since this must match what the real route
  // returns, not what would be more consistent.
  schemas.MemberRecoveryResponse = {
    type: "object",
    properties: {
      jwt: { type: "string", description: "Short-lived JWT — send as `Authorization: Bearer <jwt>`." },
      refreshToken: { type: "string" },
      user: { type: "object", properties: { id: { type: "string" }, email: { type: "string" }, role: { type: "string" } } },
    },
  }

  paths["/auth/register"] = {
    post: {
      summary: "Register a new member (end-user)",
      description: "Creates a session immediately unless the workspace requires email verification first (then returns 202 with no tokens).",
      operationId: "registerMember",
      tags: ["Authentication"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string", minLength: 6 },
                name: { type: "string" },
                avatar: { type: "string", format: "uri" },
                metadata: { type: "object" },
              },
              required: ["email", "password"],
            },
          },
        },
      },
      responses: {
        "201": { description: "Registered and signed in.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberSessionResponse" } } } },
        "202": { description: "Account created, email verification required before sign-in." },
        "403": { description: "Public registration is disabled for this workspace." },
        "409": { description: "Email already registered." },
      },
    },
  }

  paths["/auth/login"] = {
    post: {
      summary: "Log in a member (end-user)",
      operationId: "loginMember",
      tags: ["Authentication"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" }, password: { type: "string" } }, required: ["email", "password"] } } },
      },
      responses: {
        "200": { description: "Signed in.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberSessionResponse" } } } },
        "401": { description: "Invalid email or password." },
        "403": { description: "Account is not active (pending verification / suspended)." },
      },
    },
  }

  paths["/auth/refresh"] = {
    post: {
      summary: "Exchange a refresh token for a new access token",
      description: "The refresh token is single-use and rotated on every call — the response's refreshToken replaces the one sent in, which stops working.",
      operationId: "refreshMemberSession",
      tags: ["Authentication"],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { refreshToken: { type: "string" } }, required: ["refreshToken"] } } } },
      responses: {
        "200": {
          description: "New tokens issued.",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, accessToken: { type: "string" }, refreshToken: { type: "string" }, expiresIn: { type: "number" }, tokenType: { type: "string", example: "Bearer" } } } } },
        },
        "401": { description: "Invalid, expired, or already-used (compromised) refresh token — the 401 body explains which." },
      },
    },
  }

  paths["/auth/logout"] = {
    post: {
      summary: "Revoke a member's session",
      description: "Revokes the session matching the given refreshToken, if any. Always returns 200 even if the token was already invalid — logout is idempotent from the client's point of view.",
      operationId: "logoutMember",
      tags: ["Authentication"],
      requestBody: { content: { "application/json": { schema: { type: "object", properties: { refreshToken: { type: "string" } } } } } },
      responses: { "200": { description: "Session revoked (or nothing to revoke)." } },
    },
  }

  paths["/auth/me"] = {
    get: {
      summary: "Get the signed-in member's own profile",
      operationId: "getMemberProfile",
      tags: ["Authentication"],
      security: [{ BearerAuth: [] }],
      responses: {
        "200": { description: "Profile.", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/MemberUser" } } } } } },
        "401": { description: "Missing or invalid access token." },
        "404": { description: "Member not found or inactive." },
      },
    },
    patch: {
      summary: "Update the signed-in member's own profile, optionally changing their password",
      description: "Changing the password requires currentPassword and revokes every other active session for this member.",
      operationId: "updateMemberProfile",
      tags: ["Authentication"],
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                avatar: { type: "string", format: "uri" },
                metadata: { type: "object" },
                currentPassword: { type: "string" },
                newPassword: { type: "string", minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Profile updated.", content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, user: { $ref: "#/components/schemas/MemberUser" } } } } } },
        "400": { description: "currentPassword missing/incorrect when changing password." },
      },
    },
  }

  paths["/auth/forgot-password"] = {
    post: {
      summary: "Request a password-reset email",
      description: "Always responds 200 `{ ok: true }` whether or not the email is registered — never reveals which emails exist on this workspace.",
      operationId: "forgotMemberPassword",
      tags: ["Authentication"],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] } } } },
      responses: { "200": { description: "Email sent if the address is registered (response doesn't say which)." } },
    },
  }

  paths["/auth/reset-password"] = {
    post: {
      summary: "Set a new password using the code from a forgot-password email",
      operationId: "resetMemberPassword",
      tags: ["Authentication"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { code: { type: "string" }, password: { type: "string", minLength: 8 }, passwordConfirmation: { type: "string", minLength: 8 } },
              required: ["code", "password", "passwordConfirmation"],
            },
          },
        },
      },
      responses: {
        "200": { description: "Password changed, signed in.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberRecoveryResponse" } } } },
        "400": { description: "Invalid/expired code, or passwords don't match." },
      },
    },
  }

  paths["/auth/change-password"] = {
    post: {
      summary: "Change the signed-in member's password",
      operationId: "changeMemberPassword",
      tags: ["Authentication"],
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { currentPassword: { type: "string" }, password: { type: "string", minLength: 8 }, passwordConfirmation: { type: "string", minLength: 8 } },
              required: ["currentPassword", "password", "passwordConfirmation"],
            },
          },
        },
      },
      responses: {
        "200": { description: "Password changed.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberRecoveryResponse" } } } },
        "400": { description: "currentPassword incorrect, or passwords don't match." },
      },
    },
  }

  paths["/auth/email-confirmation"] = {
    post: {
      summary: "Confirm a member's email using the code from their verification email",
      operationId: "confirmMemberEmail",
      tags: ["Authentication"],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } } } },
      responses: {
        "200": { description: "Email confirmed, signed in.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberRecoveryResponse" } } } },
        "400": { description: "Invalid or expired confirmation code." },
      },
    },
  }

  paths["/auth/local"] = {
    post: {
      summary: "Strapi-compatible login (identifier/password)",
      description: "Same login, Strapi's REST Auth shape — use this instead of /auth/login when porting a Strapi frontend/plugin that expects `identifier` and a `{ jwt, user }` response.",
      operationId: "localLoginMember",
      tags: ["Authentication"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { identifier: { type: "string", description: "The member's email" }, password: { type: "string" } }, required: ["identifier", "password"] } } },
      },
      responses: {
        "200": {
          description: "Signed in (Strapi-shaped user object).",
          content: { "application/json": { schema: { type: "object", properties: { jwt: { type: "string" }, refreshToken: { type: "string" }, user: { type: "object" } } } } },
        },
        "400": { description: "Invalid identifier or password." },
        "403": { description: "Account is not active." },
      },
    },
  }

  paths["/auth/local/register"] = {
    post: {
      summary: "Strapi-compatible registration (username/email/password)",
      description: "Same registration, Strapi's REST Auth shape. Returns 202 with no tokens if the workspace requires email verification first.",
      operationId: "localRegisterMember",
      tags: ["Authentication"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object", properties: { username: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } }, required: ["email", "password"] },
          },
        },
      },
      responses: {
        "200": { description: "Registered and signed in (Strapi-shaped user object)." },
        "202": { description: "Account created, email verification required before sign-in." },
        "400": { description: "Email already taken." },
        "403": { description: "Public registration is disabled for this workspace." },
      },
    },
  }

  paths["/graphql"] = {
    post: {
      summary: "Dynamic GraphQL endpoint — fields mirror the REST schemas above",
      tags: ["GraphQL"],
      requestBody: {
        content: { "application/json": { schema: { type: "object", properties: { query: { type: "string" }, variables: { type: "object" } }, required: ["query"] } } },
      },
      responses: { "200": { description: "OK" } },
    },
  }

  paths["/brand"] = {
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
                  name: { type: "string", example: tenantName },
                  slug: { type: "string", example: tenantSlug },
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

  return {
    openapi: "3.1.0",
    info: {
      title: `${tenantName} — Headless CMS API`,
      description: `Dynamic REST API and Action Specification for **${tenantName}** powered by SaCMS.\n\nUse this specification to connect ChatGPT Custom GPTs, Google AI Studio, Manus, Emergent, v0.app, and other AI agents to manage CMS content.\n\n### Authentication — two different kinds of Bearer token, don't mix them up\n1. **Workspace API token** — for every \`/content\`, \`/single\`, and \`/graphql\` call. Provide it as \`Authorization: Bearer <YOUR_API_TOKEN>\` or header \`x-api-key: <YOUR_API_KEY>\`. This is the one credential for your backend/integration to talk to this workspace.\n2. **Member access token** — for the \`/auth/*\` endpoints under the \`Authentication\` tag below (\`/auth/me\`, \`/auth/change-password\`). This is a short-lived JWT a real end-user gets back from \`/auth/login\`/\`/auth/register\`, sent the same way (\`Authorization: Bearer <accessToken>\`), but it identifies one signed-in visitor of the app you're building, not your workspace integration — a fullstack app with its own users (not just a backend reading CMS content) needs both kinds, used in different places.`,
      version: "1.0.0",
    },
    servers: [{ url: apiBase, description: `Primary Public API Gateway for ${tenantName}` }],
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Token", description: "SaCMS API Token or Workspace Bearer Token" },
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "SaCMS API Key Header" },
      },
      schemas,
    },
    paths,
  }
}

/** CORS headers for the public, cross-origin-callable openapi.json route only — the dashboard route and the MCP tool are same-origin/non-HTTP, they don't need this. */
export { CORS_HEADERS }
