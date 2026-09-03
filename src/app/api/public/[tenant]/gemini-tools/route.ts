import { NextRequest, NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
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

    const tenant = await db.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { id: tenantSlug },
        ]
      },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Workspace tenant not found" }, { status: 404, headers: CORS_HEADERS })
    }

    const tenantDb = await getTenantDb(tenant.slug)
    const [contentTypes, singleTypes] = await Promise.all([
      tenantDb.contentType.findMany({
        where: { tenantId: tenant.id },
        select: { slug: true, name: true, description: true }
      }),
      tenantDb.singleType.findMany({
        where: { tenantId: tenant.id },
        select: { slug: true, name: true, description: true }
      })
    ])

    const availableCollections = contentTypes.map(c => `'${c.slug}' (${c.name})`).join(", ")
    const availableSingletons = singleTypes.map(s => `'${s.slug}' (${s.name})`).join(", ")

    // Format strictly following Google Gemini Function Calling Specification
    const geminiPayload = {
      tools: [
        {
          functionDeclarations: [
            {
              name: "sacms_list_entries",
              description: `Fetch published or draft content records from a collection in ${tenant.name} SaCMS. Available collections: ${availableCollections || "None"}.`,
              parameters: {
                type: "OBJECT",
                properties: {
                  contentType: {
                    type: "STRING",
                    description: `Slug of the target collection. Available: ${contentTypes.map(c => c.slug).join(", ")}`,
                  },
                  search: {
                    type: "STRING",
                    description: "Keyword search across text fields",
                  },
                  status: {
                    type: "STRING",
                    description: "Content entry status",
                    enum: ["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED"],
                  },
                  page: {
                    type: "INTEGER",
                    description: "Page number for pagination (starts at 1)",
                  },
                  pageSize: {
                    type: "INTEGER",
                    description: "Number of records per page (default: 10, max: 100)",
                  },
                  sort: {
                    type: "STRING",
                    description: "Sort order, format 'fieldName:desc' or 'fieldName:asc'",
                  },
                },
                required: ["contentType"],
              },
            },
            {
              name: "sacms_get_entry",
              description: "Fetch a single content entry from a collection by its unique ID with populated relations.",
              parameters: {
                type: "OBJECT",
                properties: {
                  contentType: {
                    type: "STRING",
                    description: "Slug of the collection",
                  },
                  id: {
                    type: "STRING",
                    description: "Unique ID of the content record",
                  },
                },
                required: ["contentType", "id"],
              },
            },
            {
              name: "sacms_create_entry",
              description: `Create a new content entry in a collection for workspace ${tenant.name}.`,
              parameters: {
                type: "OBJECT",
                properties: {
                  contentType: {
                    type: "STRING",
                    description: "Slug of the collection to insert into",
                  },
                  data: {
                    type: "OBJECT",
                    description: "Key-value pair object of the entry fields (e.g. { title: 'New Post', slug: 'new-post', body: '...' })",
                  },
                  status: {
                    type: "STRING",
                    description: "Initial status",
                    enum: ["PUBLISHED", "DRAFT", "IN_REVIEW"],
                  },
                },
                required: ["contentType", "data"],
              },
            },
            {
              name: "sacms_update_entry",
              description: "Update the field values or publish status of an existing content entry by ID.",
              parameters: {
                type: "OBJECT",
                properties: {
                  contentType: {
                    type: "STRING",
                    description: "Slug of the collection",
                  },
                  id: {
                    type: "STRING",
                    description: "Unique ID of the entry to update",
                  },
                  data: {
                    type: "OBJECT",
                    description: "Partial or full updated key-value fields",
                  },
                  status: {
                    type: "STRING",
                    description: "Updated status (optional)",
                    enum: ["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED"],
                  },
                },
                required: ["contentType", "id", "data"],
              },
            },
            {
              name: "sacms_delete_entry",
              description: "Permanently delete a content entry from a collection by ID.",
              parameters: {
                type: "OBJECT",
                properties: {
                  contentType: {
                    type: "STRING",
                    description: "Slug of the collection",
                  },
                  id: {
                    type: "STRING",
                    description: "Unique ID of the entry to delete",
                  },
                },
                required: ["contentType", "id"],
              },
            },
            {
              name: "sacms_get_single_type",
              description: `Fetch singleton page content (e.g. Homepage, About, Global Settings) for ${tenant.name}. Available singletons: ${availableSingletons || "None"}.`,
              parameters: {
                type: "OBJECT",
                properties: {
                  singleType: {
                    type: "STRING",
                    description: `Slug of the single type. Available: ${singleTypes.map(s => s.slug).join(", ")}`,
                  },
                  locale: {
                    type: "STRING",
                    description: "Language locale code (e.g. 'id', 'en')",
                  },
                },
                required: ["singleType"],
              },
            },
            {
              name: "sacms_update_single_type",
              description: "Update singleton page content and configuration.",
              parameters: {
                type: "OBJECT",
                properties: {
                  singleType: {
                    type: "STRING",
                    description: "Slug of the single type to update",
                  },
                  data: {
                    type: "OBJECT",
                    description: "Key-value data payload for this singleton",
                  },
                },
                required: ["singleType", "data"],
              },
            },
            {
              name: "sacms_get_full_schema",
              description: `Introspect and retrieve the entire database schema structure (all collections, singletons, fields, relations) of workspace ${tenant.name}.`,
              parameters: {
                type: "OBJECT",
                properties: {},
              },
            },
          ],
        },
      ],
      metadata: {
        workspace: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        instruction: "Paste this tools object directly into Google AI Studio 'Tools' tab or initialize with GoogleGenAI in Python / Node.js.",
      },
    }

    return new NextResponse(JSON.stringify(geminiPayload, null, 2), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch (error: any) {
    console.error("Gemini Tools Generator Error:", error)
    return NextResponse.json(
      { error: "Failed to generate Gemini tools declarations" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
