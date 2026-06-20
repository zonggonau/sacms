import { db, getTenantDbById } from "./database"
import { provisionEnterpriseDb } from "./enterprise-db"
import { STARTER_KITS } from "./starter-kits"

/**
 * Provision a new tenant with starter content types and demo data.
 * In Hybrid Multi-tenant mode, this also handles automatic database creation.
 */
export async function provisionTenant(tenantId: string, aiPrompt?: string, websiteType?: string) {
  try {
    console.log(`[Provisioning] Starting for tenant: ${tenantId}, Website Type: ${websiteType}`)

    // 1. Check if the tenant needs a dedicated database (Hybrid Multitenancy)
    let tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, plan: true, status: true, databaseUrl: true }
    })

    if (!tenant) throw new Error("Tenant not found")

    // Define which plans get a dedicated database
    const dedicatedPlans = ["pro", "enterprise"]
    
    // Auto-provision DB if plan matches AND it's not the 'system' tenant
    if (dedicatedPlans.includes(tenant.plan) && !tenant.databaseUrl && tenant.slug !== "system") {
      console.log(`[Provisioning] Auto-creating dedicated database for ${tenant.slug} (${tenant.plan})`)
      try {
        const newDbUrl = await provisionEnterpriseDb(tenant.slug)
        
        // Update the master tenant record with the new database URL
        tenant = await db.tenant.update({
          where: { id: tenantId },
          data: { databaseUrl: newDbUrl }
        })
        console.log(`[Provisioning] Dedicated database URL updated for ${tenant.slug}`)
      } catch (dbError) {
        console.error(`[Provisioning] Failed to create dedicated database for ${tenant.slug}`, dbError)
        // Fallback to shared DB if DB creation fails (or throw if isolation is mandatory)
      }
    }

    // Get the correct DB client (Shared or Dedicated)
    // IMPORTANT: Use forceFresh: true if it's a dedicated DB to ensure we aren't using a stale connection pool
    const tenantDb = await getTenantDbById(tenantId, !!tenant.databaseUrl)

    // 1.5 Sync Tenant, Owner, and Membership to the dedicated database if it's isolated
    if (tenant.databaseUrl) {
      console.log(`[Provisioning] Syncing tenant, owner, and membership to dedicated DB for ${tenant.slug}`)
      
      // Ensure the tenant exists in the dedicated DB
      await tenantDb.tenant.upsert({
        where: { id: tenant.id },
        update: {
          name: tenant.name,
          slug: tenant.slug, // Added slug to update just in case
          plan: tenant.plan,
          status: tenant.status,
          databaseUrl: tenant.databaseUrl
        },
        create: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
          databaseUrl: tenant.databaseUrl
        }
      })

      const ownerMember = await db.tenantMember.findFirst({
        where: { tenantId, role: "owner" },
        include: { user: true }
      })

      if (ownerMember && ownerMember.user) {
        // Sync the owner user to the dedicated DB
        await tenantDb.user.upsert({
          where: { id: ownerMember.userId },
          update: {
            email: ownerMember.user.email,
            name: ownerMember.user.name,
            password: ownerMember.user.password,
            role: ownerMember.user.role,
            image: ownerMember.user.image
          },
          create: {
            id: ownerMember.userId,
            email: ownerMember.user.email,
            name: ownerMember.user.name,
            password: ownerMember.user.password,
            role: ownerMember.user.role,
            image: ownerMember.user.image
          }
        })

        // Sync the membership to the dedicated DB
        await tenantDb.tenantMember.upsert({
          where: {
            tenantId_userId: {
              tenantId: tenant.id,
              userId: ownerMember.userId
            }
          },
          update: { role: ownerMember.role },
          create: {
            id: ownerMember.id,
            tenantId: tenant.id,
            userId: ownerMember.userId,
            role: ownerMember.role
          }
        })
      }
      
      // Sync all global locales to the dedicated DB to ensure localized fields work
      const globalLocales = await db.tenantLocale.findMany({ where: { tenantId } })
      for (const loc of globalLocales) {
        await tenantDb.tenantLocale.upsert({
          where: { tenantId_locale: { tenantId, locale: loc.locale } },
          update: { name: loc.name, isDefault: loc.isDefault, isEnabled: loc.isEnabled },
          create: { tenantId, locale: loc.locale, name: loc.name, isDefault: loc.isDefault, isEnabled: loc.isEnabled }
        })
      }
    }

    // 2. Generate Architecture (DB Template or Starter Kit)
    let contentTypes: any[] = []
    let singleTypes: any[] = []
    let components: any[] = []

    if (websiteType && websiteType !== 'custom') {
      console.log(`[Provisioning] Searching for DB Template matching: ${websiteType}`)
      const templateCt = await db.contentType.findFirst({
        where: { slug: "templates", tenantId: null }
      })

      if (templateCt) {
        const entries = await db.contentEntry.findMany({
          where: { contentTypeId: templateCt.id, status: "PUBLISHED" }
        })

        console.log(`[Provisioning] Found ${entries.length} published templates in DB.`)

        const dbTemplate = entries.find(e => {
          const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
          const match = e.id === websiteType || 
                        d.template_id === websiteType || 
                        d.slug === websiteType || 
                        d.name === websiteType ||
                        d.nama_template === websiteType
          return match
        })

        if (dbTemplate) {
          const d = typeof dbTemplate.data === 'string' ? JSON.parse(dbTemplate.data) : dbTemplate.data
          const schema = d.schema_template || d.schemaTemplate || {}
          console.log(`[Provisioning] Successfully matched DB Template: ${d.name || d.nama_template}`)

          // Support both snake_case and camelCase for schema properties
          contentTypes = schema.content_types || schema.contentTypes || []
          singleTypes = schema.single_types || schema.singleTypes || []
          components = schema.components || []

          console.log(`[Provisioning] Parsed schema: ${contentTypes.length} CTs, ${singleTypes.length} STs, ${components.length} Comps`)
        } else {
          console.warn(`[Provisioning] Template '${websiteType}' not found in DB entries. Check if ID or template_id matches.`)
        }

      }
    }

    // If still empty, try static starter kits
    if (contentTypes.length === 0 && singleTypes.length === 0 && components.length === 0) {
      if (websiteType && STARTER_KITS[websiteType]) {
        console.log(`[Provisioning] Using Static Starter Kit: ${websiteType}`)
        const kit = STARTER_KITS[websiteType]
        contentTypes = kit.contentTypes || []
        singleTypes = kit.singleTypes || []
        components = kit.components || []
      }
    }

    // Ultimate fallback if still empty (ONLY if not explicitly requested 'custom'/blank)
    if (contentTypes.length === 0 && singleTypes.length === 0 && components.length === 0 && websiteType !== 'custom') {
      console.log("[Provisioning] No template found, falling back to sacms-starter")
      const kit = STARTER_KITS["sacms-starter"]
      contentTypes = kit.contentTypes
      singleTypes = kit.singleTypes
      components = kit.components
    }

    // 3. Create Components
    for (const comp of components) {
      await tenantDb.$transaction(async (tx) => {
        const existing = await tx.component.findFirst({
          where: { tenantId, slug: comp.slug }
        })

        if (!existing) {
          await tx.component.create({
            data: {
              tenantId,
              name: comp.name,
              slug: comp.slug,
              category: comp.category || "General",
              schemaFields: { create: comp.fields.map((f: any, idx: number) => {
                  let fOptions = f.options || {}
                  if (typeof fOptions === 'string') {
                    try { fOptions = JSON.parse(fOptions) } catch { fOptions = {} }
                  }
                  
                  const cSlug = f.componentSlug || (fOptions as any).componentSlug || null
                  if (cSlug) fOptions.componentSlug = cSlug

                  return {
                    name: f.name,
                    slug: f.slug,
                    type: f.type,
                    required: !!f.required,
                    order: idx,
                    relationSlug: f.relationSlug || f.relationTo || null,
                    options: fOptions,
                  }
                })
              }
            }
          })
        }
      })
    }

    // 4. Create Collection Types
    for (const ct of contentTypes) {
      await tenantDb.$transaction(async (tx) => {
        const existing = await tx.contentType.findFirst({
          where: { tenantId, slug: ct.slug }
        })

        if (!existing) {
          const contentType = await tx.contentType.create({
            data: {
              tenantId,
              name: ct.name,
              slug: ct.slug,
              description: ct.description || "",
              isPublished: true,
              schemaFields: { create: ct.fields.map((f: any, idx: number) => {
                  let fOptions = f.options || {}
                  if (typeof fOptions === 'string') {
                    try { fOptions = JSON.parse(fOptions) } catch { fOptions = {} }
                  }
                  
                  const cSlug = f.componentSlug || (fOptions as any).componentSlug || null
                  if (cSlug) fOptions.componentSlug = cSlug

                  return {
                    name: f.name,
                    slug: f.slug,
                    type: f.type,
                    required: !!f.required,
                    order: idx,
                    relationSlug: f.relationSlug || f.relationTo || null,
                    options: fOptions,
                  }
                })
              }
            }
          })

          await tx.tenantContentTypeAssignment.upsert({
            where: {
              tenantId_contentTypeId: {
                tenantId,
                contentTypeId: contentType.id
              }
            },
            update: { enabled: true },
            create: {
              tenantId,
              contentTypeId: contentType.id,
              enabled: true
            }
          })
        }
      })
    }

    // 5. Create Single Types
    for (const st of singleTypes) {
      await tenantDb.$transaction(async (tx) => {
        const existing = await tx.singleType.findFirst({
          where: { tenantId, slug: st.slug }
        })

        if (!existing) {
          const singleType = await tx.singleType.create({
            data: {
              tenantId,
              name: st.name,
              slug: st.slug,
              description: st.description || "",
              isPublished: true,
              schemaFields: { create: st.fields.map((f: any, idx: number) => {
                  let optionsObj = f.options || {}
                  if (typeof optionsObj === 'string') {
                    try {
                      optionsObj = JSON.parse(optionsObj)
                    } catch (e) {
                      optionsObj = {}
                    }
                  }
                  
                  const cSlug = f.componentSlug || (optionsObj as any).componentSlug || null
                  if (cSlug) (optionsObj as any).componentSlug = cSlug
                  
                  return {
                    name: f.name,
                    slug: f.slug,
                    type: f.type,
                    required: !!f.required,
                    order: idx,
                    relationSlug: f.relationSlug || f.relationTo || null,
                    options: optionsObj,
                  }
                })
              }
            }
          })

          // Set initial data for site identity types
          const initialData: any = {}
          if (st.slug.includes("identity") || st.slug.includes("site") || st.slug.includes("setting")) {
            initialData.brandName = tenant.name
            initialData.siteName = tenant.name
          }

          await tx.tenantSingleTypeAssignment.upsert({
            where: {
              tenantId_singleTypeId_locale: {
                tenantId,
                singleTypeId: singleType.id,
                locale: "en"
              }
            },
            update: { enabled: true },
            create: {
              tenantId,
              singleTypeId: singleType.id,
              enabled: true,
              data: JSON.stringify(initialData),
              publishedAt: new Date()
            }
          })
        }
      })
    }

    console.log(`[Provisioning] Completed for tenant: ${tenantId}`)

    // 6. Update status to active
    await db.tenant.update({
      where: { id: tenantId },
      data: { status: "active" }
    })

    return true
  } catch (error) {
    console.error(`[Provisioning] Failed for tenant: ${tenantId}`, error)
    
    // Update status to failed
    await db.tenant.update({
      where: { id: tenantId },
      data: { status: "failed" }
    }).catch(console.error)

    return false
  }
}
