/**
 * In-Process MCP Client Bridge for SaCMS AI Website Builder
 *
 * Allows server-side AI agents and Builder workflows to directly invoke
 * the SaCMS MCP tool suite without HTTP latency or token roundtrips.
 */

import { db, getTenantDb } from "@/lib/database"
import { triggerWebhooks } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"

export interface SchemaFieldInput {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string
  options?: any
  order?: number
}

export interface ContentTypeInput {
  name: string
  slug: string
  description?: string
  fields: SchemaFieldInput[]
}

export interface SingleTypeInput {
  name: string
  slug: string
  description?: string
  fields: SchemaFieldInput[]
}

export interface ComponentInput {
  name: string
  slug: string
  description?: string
  category?: string
  fields: SchemaFieldInput[]
}

export interface ContentEntryInput {
  contentTypeSlug: string
  data: Record<string, any>
  status?: "DRAFT" | "PUBLISHED"
  locale?: string
}

export class McpClientBridge {
  constructor(
    public readonly tenantId: string,
    public readonly tenantSlug: string,
    public readonly userId?: string
  ) {}

  private async getDb() {
    return await getTenantDb(this.tenantSlug)
  }

  /**
   * Resolve the default locale for this tenant (instead of hardcoding "en")
   */
  private async getDefaultLocale(): Promise<string> {
    try {
      const tenantDb = await this.getDb()
      const defaultLocale = await tenantDb.tenantLocale.findFirst({
        where: { tenantId: this.tenantId, isDefault: true },
      })
      return defaultLocale?.locale ?? "en"
    } catch {
      return "en"
    }
  }

  /**
   * 1. Get complete workspace schema (Content Types, Single Types, Components)
   */
  async getFullSchema() {
    const tenantDb = await this.getDb()
    const [contentTypes, singleTypes, components] = await Promise.all([
      tenantDb.contentType.findMany({
        where: { tenantId: this.tenantId },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.singleType.findMany({
        where: { tenantId: this.tenantId },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.component.findMany({
        where: { tenantId: this.tenantId },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
    ])

    const mapFields = (fields: any[]) =>
      fields.map((f) => ({
        name: f.name,
        slug: f.slug,
        type: f.type,
        required: f.required,
        unique: f.unique,
        localizable: f.localizable,
        ...(f.relationSlug ? { relationSlug: f.relationSlug } : {}),
        ...(f.options ? { options: f.options } : {}),
      }))

    return {
      workspace: { id: this.tenantId, slug: this.tenantSlug },
      contentTypes: contentTypes.map((ct) => ({
        id: ct.id,
        name: ct.name,
        slug: ct.slug,
        description: ct.description,
        fields: mapFields(ct.schemaFields),
      })),
      singleTypes: singleTypes.map((st) => ({
        id: st.id,
        name: st.name,
        slug: st.slug,
        description: st.description,
        fields: mapFields(st.schemaFields),
      })),
      components: components.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
        description: c.description,
        fields: mapFields(c.schemaFields),
      })),
    }
  }

  /**
   * 2. Create a new Content Type (Collection)
   */
  async createContentType(input: ContentTypeInput) {
    const tenantDb = await this.getDb()
    const existing = await tenantDb.contentType.findFirst({
      where: { tenantId: this.tenantId, slug: input.slug },
    })
    if (existing) {
      return { success: false, error: `ContentType with slug '${input.slug}' already exists`, item: existing }
    }

    const created = await tenantDb.contentType.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        isPublished: true,
        schemaFields: {
          create: input.fields.map((f, i) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required ?? false,
            unique: f.unique ?? false,
            relationSlug: f.relationSlug,
            options: f.options ?? undefined,
            order: f.order ?? i,
          })),
        },
      },
      include: { schemaFields: true },
    })

    // Fire webhook & audit log for schema creation
    triggerWebhooks(this.tenantId, "content_type.created", { contentType: { id: created.id, slug: created.slug, name: created.name } })
    logAudit({ tenantId: this.tenantId, userId: this.userId, action: "content_type.created", entity: "ContentType", entityId: created.id, data: { slug: created.slug, fieldsCount: input.fields.length, source: "ai_builder_mcp" } })

    return { success: true, item: created }
  }

  /**
   * 3. Create a Single Type (One-off page)
   */
  async createSingleType(input: SingleTypeInput) {
    const tenantDb = await this.getDb()
    const existing = await tenantDb.singleType.findFirst({
      where: { tenantId: this.tenantId, slug: input.slug },
    })
    if (existing) {
      return { success: false, error: `SingleType with slug '${input.slug}' already exists`, item: existing }
    }

    const created = await tenantDb.singleType.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        isPublished: true,
        schemaFields: {
          create: input.fields.map((f, i) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required ?? false,
            unique: f.unique ?? false,
            relationSlug: f.relationSlug,
            options: f.options ?? undefined,
            order: f.order ?? i,
          })),
        },
      },
      include: { schemaFields: true },
    })

    // Fire webhook & audit log for single type creation
    triggerWebhooks(this.tenantId, "single_type.created", { singleType: { id: created.id, slug: created.slug, name: created.name } })
    logAudit({ tenantId: this.tenantId, userId: this.userId, action: "single_type.created", entity: "SingleType", entityId: created.id, data: { slug: created.slug, fieldsCount: input.fields.length, source: "ai_builder_mcp" } })

    return { success: true, item: created }
  }

  /**
   * 4. Create a Component (Reusable block)
   */
  async createComponent(input: ComponentInput) {
    const tenantDb = await this.getDb()
    const existing = await tenantDb.component.findFirst({
      where: { tenantId: this.tenantId, slug: input.slug },
    })
    if (existing) {
      return { success: false, error: `Component with slug '${input.slug}' already exists`, item: existing }
    }

    const created = await tenantDb.component.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        slug: input.slug,
        category: input.category || "default",
        description: input.description,
        schemaFields: {
          create: input.fields.map((f, i) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required ?? false,
            unique: f.unique ?? false,
            relationSlug: f.relationSlug,
            options: f.options ?? undefined,
            order: f.order ?? i,
          })),
        },
      },
      include: { schemaFields: true },
    })

    // Fire webhook & audit log for component creation
    triggerWebhooks(this.tenantId, "component.created", { component: { id: created.id, slug: created.slug, name: created.name } })
    logAudit({ tenantId: this.tenantId, userId: this.userId, action: "component.created", entity: "Component", entityId: created.id, data: { slug: created.slug, source: "ai_builder_mcp" } })

    return { success: true, item: created }
  }

  /**
   * 5. Populate initial mock / live content entry
   */
  async createContentEntry(input: ContentEntryInput) {
    const tenantDb = await this.getDb()
    const ct = await tenantDb.contentType.findFirst({
      where: { tenantId: this.tenantId, slug: input.contentTypeSlug },
    })
    if (!ct) {
      return { success: false, error: `ContentType '${input.contentTypeSlug}' not found` }
    }

    // Resolve default locale from TenantLocale instead of hardcoding "en"
    const resolvedLocale = input.locale || await this.getDefaultLocale()

    const entry = await tenantDb.contentEntry.create({
      data: {
        tenantId: this.tenantId,
        contentTypeId: ct.id,
        data: input.data,
        status: input.status || "PUBLISHED",
        locale: resolvedLocale,
        publishedAt: input.status === "DRAFT" ? null : new Date(),
      },
    })

    // Fire webhook & audit log for content creation
    triggerWebhooks(this.tenantId, "content.created", { entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status } })
    logAudit({ tenantId: this.tenantId, userId: this.userId, action: AuditAction.CONTENT_CREATED, entity: "ContentEntry", entityId: entry.id, data: { contentType: input.contentTypeSlug, locale: resolvedLocale, source: "ai_builder_mcp" } })

    return { success: true, entry }
  }

  /**
   * 6. Create Webhook
   */
  async createWebhook(input: { name: string; url: string; events: string[] }) {
    const tenantDb = await this.getDb()
    const webhook = await tenantDb.webhook.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        url: input.url,
        events: input.events || ["content.created", "content.updated", "content.deleted"],
        enabled: true,
      }
    })
    return { success: true, webhook }
  }

  /**
   * 7. Inspect API Key & Token Permissions / Capabilities
   */
  async inspectApiCapabilities(apiKey?: string) {
    const tenantDb = await this.getDb()
    if (!apiKey) {
      // Default generated token capability for the AI Builder
      return {
        mode: "full_access",
        permissions: ["read", "write", "delete", "schema", "webhooks", "mcp"],
        canRead: true,
        canWrite: true,
        canDelete: true,
        canModifySchema: true,
        description: "Full read-write-delete access for AI-generated dynamic components and interactive workflows",
      }
    }

    const token = await tenantDb.apiToken.findFirst({
      where: {
        tenantId: this.tenantId,
        token: apiKey,
      }
    })

    if (!token) {
      return {
        mode: "read_only",
        permissions: ["read"],
        canRead: true,
        canWrite: false,
        canDelete: false,
        canModifySchema: false,
        description: "Public read-only consumer access",
      }
    }

    const perms: string[] = Array.isArray(token.permissions) ? (token.permissions as string[]) : []
    return {
      tokenId: token.id,
      name: token.name,
      permissions: perms,
      canRead: perms.includes("read") || perms.includes("full_access"),
      canWrite: perms.includes("write") || perms.includes("full_access"),
      canDelete: perms.includes("delete") || perms.includes("full_access"),
      canModifySchema: perms.includes("schema") || perms.includes("full_access"),
      description: `Token with permissions: ${perms.join(", ")}`,
    }
  }

  /**
   * 8. Get complete project context for AI Website Generator
   */
  async getProjectContext() {
    const tenantDb = await this.getDb()
    const [tenant, schema, defaultLocale] = await Promise.all([
      tenantDb.tenant.findUnique({
        where: { id: this.tenantId },
        select: { id: true, name: true, slug: true, brandName: true, brandLogo: true, primaryColor: true }
      }),
      this.getFullSchema(),
      this.getDefaultLocale(),
    ])

    return {
      tenant,
      schema,
      defaultLocale,
      apiBaseUrl: `/api/public/${this.tenantSlug}`,
      mcpBaseUrl: `/api/mcp`,
    }
  }

  /**
   * 9. Apply full generated schema (Content Types, Single Types, Components, and Dummy Data)
   */
  async applyGeneratedSchema(schema: {
    contentTypes?: Array<{
      name: string
      slug: string
      description?: string
      fields: Array<{ name: string; slug: string; type: string; required?: boolean; unique?: boolean; relationSlug?: string; componentSlug?: string; options?: any }>
      dummyData?: Record<string, any>[]
    }>
    singleTypes?: Array<{
      name: string
      slug: string
      description?: string
      fields: Array<{ name: string; slug: string; type: string; required?: boolean; unique?: boolean; relationSlug?: string; componentSlug?: string; options?: any }>
      dummyData?: Record<string, any>
    }>
    components?: Array<{
      name: string
      slug: string
      description?: string
      category?: string
      fields: Array<{ name: string; slug: string; type: string; required?: boolean; unique?: boolean }>
    }>
  }) {
    const tenantDb = await this.getDb()
    const results = {
      contentTypesCreated: 0,
      singleTypesCreated: 0,
      componentsCreated: 0,
      entriesCreated: 0,
    }

    // 1. Create Components
    for (const comp of schema.components || []) {
      const res = await this.createComponent({
        name: comp.name,
        slug: comp.slug,
        description: comp.description,
        category: comp.category,
        fields: comp.fields,
      })
      if (res.success) results.componentsCreated++
    }

    // 2. Create Content Types and seed dummyData
    for (const ct of schema.contentTypes || []) {
      const res = await this.createContentType({
        name: ct.name,
        slug: ct.slug,
        description: ct.description,
        fields: ct.fields,
      })
      if (res.success) {
        results.contentTypesCreated++
        // Seed dummy entries
        if (Array.isArray(ct.dummyData) && ct.dummyData.length > 0) {
          for (const item of ct.dummyData) {
            await this.createContentEntry({
              contentTypeSlug: ct.slug,
              data: item,
              status: "PUBLISHED",
            })
            results.entriesCreated++
          }
        }
      }
    }

    // 3. Create Single Types and seed dummyData
    const resolvedLocale = await this.getDefaultLocale()
    for (const st of schema.singleTypes || []) {
      const res = await this.createSingleType({
        name: st.name,
        slug: st.slug,
        description: st.description,
        fields: st.fields,
      })
      if (res.success) {
        results.singleTypesCreated++
        // Seed initial single type data assignment
        const singleData = Array.isArray(st.dummyData) ? st.dummyData[0] : st.dummyData
        if (singleData && typeof singleData === "object" && res.item) {
          const singleTypeId = (res.item as any).id
          await tenantDb.tenantSingleTypeAssignment.upsert({
            where: { tenantId_singleTypeId_locale: { tenantId: this.tenantId, singleTypeId, locale: resolvedLocale } },
            create: { tenantId: this.tenantId, singleTypeId, locale: resolvedLocale, data: singleData, enabled: true },
            update: { data: singleData },
          })
        }
      }
    }

    return results
  }

  /**
   * 10. Generic MCP Tool Dispatcher
   */
  async executeTool(toolName: string, args: Record<string, any> = {}) {
    switch (toolName) {
      case "get_full_schema":
        return await this.getFullSchema()
      case "inspect_api_capabilities":
        return await this.inspectApiCapabilities(args?.apiKey)
      case "get_project_context":
        return await this.getProjectContext()
      case "apply_generated_schema":
        return await this.applyGeneratedSchema(args?.schema || args)
      case "create_content_type":
        return await this.createContentType(args as ContentTypeInput)
      case "create_single_type":
        return await this.createSingleType(args as SingleTypeInput)
      case "create_component":
        return await this.createComponent(args as ComponentInput)
      case "create_content_entry":
        return await this.createContentEntry(args as ContentEntryInput)
      case "create_webhook":
        return await this.createWebhook(args as any)
      default:
        throw new Error(`Tool '${toolName}' is not implemented in in-process bridge.`)
    }
  }
}
