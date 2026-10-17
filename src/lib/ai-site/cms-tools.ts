import "server-only"

import { tool } from "ai"
import { z } from "zod"
import { VALID_FIELD_TYPES } from "@/lib/field-types"
import {
  createContentTypeAction,
  updateContentTypeAction,
  deleteContentTypeAction,
} from "@/actions/content-types"
import {
  getSingleTypesAction,
  getSingleTypeBySlugAction,
  createSingleTypeAction,
  updateSingleTypeAction,
  deleteSingleTypeAction,
} from "@/actions/single-types"
import {
  getComponentBySlugAction,
  createComponentAction,
  updateComponentAction,
  deleteComponentAction,
} from "@/actions/components"
import {
  getWebhooksAction,
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
} from "@/actions/webhooks"
import { getContentTypeForTenant } from "@/lib/cms-introspection"
import type { PrismaClient } from "../../../prisma/generated-client"

/**
 * CMS-builder tools that let the AI Site agent scaffold the tenant's actual
 * CMS schema (Content Types, Single Types, Components) and Webhooks while
 * building the frontend — not just read them (cms-introspection.ts covers
 * reads). These call the exact same server actions the dashboard's own
 * Content Types / Single Types / Components / Webhooks screens call, so
 * there is one source of truth for validation, plan limits, and RBAC; no
 * logic is duplicated here.
 *
 * Valid webhook event names (src/.../webhooks-client.tsx): content.created,
 * content.updated, content.deleted, content.published, content.unpublished,
 * media.uploaded, media.deleted.
 */

// `.optional()` on a 4+-key zod object schema breaks `tool()`'s overload
// resolution in this ai/zod version combo (see memory:
// tenant-db-transaction-array-bug's sibling finding) — every field here
// uses `.default()` instead, even where the value is semantically optional.
const fieldSchema = z.object({
  name: z.string().describe("Field display name, e.g. 'Title', 'Price'"),
  slug: z.string().describe("Field slug, e.g. 'title', 'price'"),
  type: z.enum(VALID_FIELD_TYPES).describe("Field type — call cms_list_field_types for the full list"),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  localizable: z.boolean().default(true),
  relationSlug: z.string().default("").describe("For type 'relation': slug of the target Content Type. Empty for other types."),
  // z.record() here would emit a JSON Schema `propertyNames` keyword that
  // OpenAI's structured-output schema dialect doesn't support (silently
  // stripped with a console warning — harmless, since object keys are
  // always strings anyway, but noisy). z.looseObject({}) is the same "any
  // extra keys" shape without triggering it, for any model.
  options: z.looseObject({}).default({}).describe("Extra field options, e.g. { currencyCode: 'IDR' } or { choices: [...] }"),
})

interface CmsToolContext {
  tenantSlug: string
  tenantId: string
  tenantDb: PrismaClient
}

export function cmsBuilderTools({ tenantSlug, tenantId, tenantDb }: CmsToolContext) {
  return {
    cms_list_field_types: tool({
      description: "List every supported Content Type / Single Type / Component field type identifier.",
      inputSchema: z.object({}),
      execute: async () => VALID_FIELD_TYPES,
    }),

    // ── Content Types ──────────────────────────────────────────────────
    cms_create_content_type: tool({
      description: "Create a new Content Type (collection), e.g. 'articles', 'products', with its fields.",
      inputSchema: z.object({
        name: z.string().describe("Display name, e.g. 'Blog Post'"),
        slug: z.string().describe("URL-safe slug, e.g. 'articles'"),
        description: z.string().default(""),
        showInCms: z.boolean().default(true),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ name, slug, description, showInCms, fields }) => {
        const result = await createContentTypeAction(tenantSlug, { name, slug, description, showInCms, fields })
        return "error" in result ? result : { contentType: result.contentType }
      },
    }),

    cms_update_content_type: tool({
      description:
        "Replace a Content Type's name, description, showInCms flag, and field list. This is a full replace of the fields — call cms_get_content_type first and pass back the complete desired field list, not just the changed fields.",
      inputSchema: z.object({
        slug: z.string().describe("Current slug of the Content Type to update"),
        name: z.string(),
        description: z.string().default(""),
        showInCms: z.boolean().default(true),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ slug, name, description, showInCms, fields }) => {
        const existing = await getContentTypeForTenant(tenantDb, tenantId, slug)
        if (!existing) return { error: `Content Type '${slug}' not found.` }
        const result = await updateContentTypeAction(tenantSlug, existing.id, { name, description, showInCms, fields })
        return "error" in result ? result : { contentType: result.contentType }
      },
    }),

    cms_delete_content_type: tool({
      description: "Permanently delete a Content Type, its fields, and all its stored entries.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const existing = await getContentTypeForTenant(tenantDb, tenantId, slug)
        if (!existing) return { error: `Content Type '${slug}' not found.` }
        return deleteContentTypeAction(tenantSlug, existing.id)
      },
    }),

    // ── Single Types ───────────────────────────────────────────────────
    cms_list_single_types: tool({
      description: "List all Single Types (one-off pages like 'homepage', 'about-us') with their field schemas.",
      inputSchema: z.object({}),
      execute: async () => getSingleTypesAction(tenantSlug),
    }),

    cms_get_single_type: tool({
      description: "Get a Single Type's field schema and its currently saved data by slug.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => getSingleTypeBySlugAction(tenantSlug, slug),
    }),

    cms_create_single_type: tool({
      description: "Create a new Single Type (a one-off page like 'homepage' or 'about-us') with its fields.",
      inputSchema: z.object({
        name: z.string().describe("Display name, e.g. 'Homepage'"),
        slug: z.string().describe("URL-safe slug, e.g. 'homepage'"),
        description: z.string().default(""),
        showInCms: z.boolean().default(true),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ name, slug, description, showInCms, fields }) => {
        const result = await createSingleTypeAction(tenantSlug, { name, slug, description, showInCms, fields })
        return "error" in result ? result : { singleType: result.singleType }
      },
    }),

    cms_update_single_type: tool({
      description:
        "Replace a Single Type's name, slug, description, showInCms flag, and field list. Full replace of the fields — call cms_get_single_type first and pass back the complete desired field list.",
      inputSchema: z.object({
        slug: z.string().describe("Current slug of the Single Type to update"),
        newSlug: z.string().default("").describe("Empty to keep the current slug"),
        name: z.string(),
        description: z.string().default(""),
        showInCms: z.boolean().default(true),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ slug, newSlug, name, description, showInCms, fields }) => {
        const existing = await getSingleTypeBySlugAction(tenantSlug, slug)
        if ("error" in existing) return existing
        const result = await updateSingleTypeAction(tenantSlug, existing.singleType.id, {
          name,
          slug: newSlug || slug,
          description,
          showInCms,
          fields,
        })
        return "error" in result ? result : { singleType: result.singleType }
      },
    }),

    cms_delete_single_type: tool({
      description: "Permanently delete a Single Type and its stored data.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const existing = await getSingleTypeBySlugAction(tenantSlug, slug)
        if ("error" in existing) return existing
        return deleteSingleTypeAction(tenantSlug, existing.singleType.id)
      },
    }),

    // ── Components ──────────────────────────────────────────────────────
    cms_get_component: tool({
      description: "Get a reusable Component's field schema by slug.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => getComponentBySlugAction(tenantSlug, slug),
    }),

    cms_create_component: tool({
      description: "Create a new reusable Component (e.g. 'Hero Section', 'Feature Card') with its fields.",
      inputSchema: z.object({
        name: z.string().describe("Display name, e.g. 'Hero Section'"),
        slug: z.string().describe("URL-safe slug, e.g. 'hero_section'"),
        description: z.string().default(""),
        category: z.string().default("Other"),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ name, slug, description, category, fields }) => {
        const result = await createComponentAction(tenantSlug, { name, slug, description, category, fields })
        return "error" in result ? result : { component: result.component }
      },
    }),

    cms_update_component: tool({
      description:
        "Replace a Component's name, description, category, and field list. Full replace of the fields — call cms_get_component first and pass back the complete desired field list.",
      inputSchema: z.object({
        slug: z.string().describe("Current slug of the Component to update"),
        name: z.string(),
        description: z.string().default(""),
        category: z.string().default("Other"),
        fields: z.array(fieldSchema).default([]),
      }),
      execute: async ({ slug, name, description, category, fields }) => {
        const existing = await getComponentBySlugAction(tenantSlug, slug)
        if ("error" in existing) return existing
        const result = await updateComponentAction(tenantSlug, existing.component.id, { name, description, category, fields })
        return "error" in result ? result : { component: result.component }
      },
    }),

    cms_delete_component: tool({
      description: "Permanently delete a reusable Component.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const existing = await getComponentBySlugAction(tenantSlug, slug)
        if ("error" in existing) return existing
        return deleteComponentAction(tenantSlug, existing.component.id)
      },
    }),

    // ── Webhooks ────────────────────────────────────────────────────────
    cms_list_webhooks: tool({
      description: "List this workspace's webhooks (id, name, url, events, enabled status).",
      inputSchema: z.object({}),
      execute: async () => getWebhooksAction(tenantSlug),
    }),

    cms_create_webhook: tool({
      description:
        "Create a webhook. Valid events: content.created, content.updated, content.deleted, content.published, content.unpublished, media.uploaded, media.deleted.",
      inputSchema: z.object({
        name: z.string(),
        url: z.string().describe("HTTPS URL to POST the event payload to"),
        events: z.array(z.string()).min(1),
        enabled: z.boolean().default(true),
      }),
      execute: async ({ name, url, events, enabled }) => {
        const result = await createWebhookAction(tenantSlug, { name, url, events, enabled, hookType: "async" })
        return "error" in result ? result : { webhook: result.webhook }
      },
    }),

    cms_update_webhook: tool({
      description: "Replace a webhook's name, url, events, and enabled status. Get the webhookId from cms_list_webhooks.",
      inputSchema: z.object({
        webhookId: z.string(),
        name: z.string(),
        url: z.string(),
        events: z.array(z.string()).min(1),
        enabled: z.boolean().default(true),
      }),
      execute: async ({ webhookId, name, url, events, enabled }) => {
        const result = await updateWebhookAction(tenantSlug, webhookId, { name, url, events, enabled })
        return "error" in result ? result : { webhook: result.webhook }
      },
    }),

    cms_delete_webhook: tool({
      description: "Permanently delete a webhook. Get the webhookId from cms_list_webhooks.",
      inputSchema: z.object({ webhookId: z.string() }),
      execute: async ({ webhookId }) => deleteWebhookAction(tenantSlug, webhookId),
    }),
  }
}
