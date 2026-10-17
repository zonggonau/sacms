import "server-only"

import { tool } from "ai"
import { z } from "zod"
import type { PrismaClient } from "../../../prisma/generated-client"
import {
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
  type EntryWriteContext,
  type ContentActor,
} from "@/lib/content/entry-service"

interface EntryToolContext {
  tenantDb: PrismaClient
  tenantId: string
  tenantSlug: string
  userId: string
  role: string
}

/**
 * Lets the agent seed/edit real content entries (actual rows, not schema) so
 * a generated site has something real to fetch via the SDK instead of an
 * empty collection — cms_query_content (tools.ts) already covers listing.
 * Goes through the exact same entry-service.ts functions the dashboard's
 * own content editor and the MCP server's create/update/delete_content_entry
 * tools call — same validation, workflow-transition, and plan-limit checks,
 * driven by the real signed-in user's actual role (a "staff" actor, not a
 * "system" bypass), not a shortcut.
 */
export function contentEntryTools({ tenantDb, tenantId, tenantSlug, userId, role }: EntryToolContext) {
  const ctx: EntryWriteContext = { client: tenantDb, tenantId, tenantSlug, enforcePlan: true }
  const actor: ContentActor = { kind: "staff", userId, role }

  return {
    cms_create_content_entry: tool({
      description:
        "Create a real content entry (a row of actual data) in a Content Type collection — use this to seed realistic sample content so the generated site has something real to display instead of an empty list.",
      inputSchema: z.object({
        contentTypeSlug: z.string().describe("Slug of the target Content Type, e.g. 'products'."),
        data: z.looseObject({}).describe("Field values matching the Content Type's schema, e.g. { title: 'Espresso', price: 25000 }."),
        status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW"]).default("PUBLISHED"),
        locale: z.string().default("id"),
      }),
      execute: async ({ contentTypeSlug, data, status, locale }) => {
        const result = await createContentEntry(ctx, actor, { contentTypeSlug, data, status, locale })
        return result.ok ? result.data : { error: result.message }
      },
    }),

    cms_get_content_entry: tool({
      description: "Fetch one content entry by its ID, including every field value.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const entry = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId },
          include: { contentType: { select: { slug: true, name: true } } },
        })
        if (!entry) return { error: `Content entry '${id}' not found.` }
        return {
          id: entry.id,
          contentType: entry.contentType?.slug,
          status: entry.status,
          locale: entry.locale,
          ...(typeof entry.data === "object" && entry.data !== null ? entry.data : {}),
        }
      },
    }),

    cms_update_content_entry: tool({
      description:
        "Update an existing content entry. data (when non-empty) is MERGED into the existing fields, not a full replace; status (when non-empty) changes the workflow status.",
      inputSchema: z.object({
        id: z.string(),
        contentTypeSlug: z.string().describe("Slug of the entry's Content Type."),
        data: z.looseObject({}).default({}).describe("Field values to merge in. Leave empty to only change status."),
        status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", ""]).default("").describe("New status, or empty to leave unchanged."),
      }),
      execute: async ({ id, contentTypeSlug, data, status }) => {
        const result = await updateContentEntry(ctx, actor, {
          contentTypeSlug,
          entryId: id,
          data: Object.keys(data).length > 0 ? data : undefined,
          status: status || undefined,
        })
        return result.ok ? result.data : { error: result.message }
      },
    }),

    cms_delete_content_entry: tool({
      description: "Permanently delete one content entry by its ID.",
      inputSchema: z.object({
        id: z.string(),
        contentTypeSlug: z.string().describe("Slug of the entry's Content Type."),
      }),
      execute: async ({ id, contentTypeSlug }) => {
        const result = await deleteContentEntry(ctx, actor, { contentTypeSlug, entryId: id })
        return result.ok ? result.data : { error: result.message }
      },
    }),
  }
}
