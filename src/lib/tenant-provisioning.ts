import { db, getTenantDbById } from "./database"
import { provisionEnterpriseDb } from "./enterprise-db"
import { generateAISchema } from "./ai-schema-generator"
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
      
      await tenantDb.tenant.upsert({
        where: { id: tenant.id },
        update: {
          name: tenant.name,
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
    }

    // 2. Generate Architecture (AI-Driven or Starter Kit)
    let contentTypes: any[] = []
    let singleTypes: any[] = []
    let components: any[] = []

    if (websiteType && STARTER_KITS[websiteType]) {
      console.log(`[Provisioning] Using Manual Starter Kit: ${websiteType}`)
      const kit = STARTER_KITS[websiteType]
      contentTypes = kit.contentTypes
      singleTypes = kit.singleTypes
      components = kit.components
    } else {
      // If no prompt, generate based on workspace name
      const effectivePrompt = aiPrompt && aiPrompt.trim().length > 5 
        ? aiPrompt 
        : `A professional website named "${tenant.name}". Create a complete, high-quality CMS structure with standard blog, categories, and site settings.`

      console.log(`[Provisioning] Designing architecture via AI for prompt: ${effectivePrompt.substring(0, 100)}...`)
      
      try {
        const aiSchema = await generateAISchema(effectivePrompt)
        contentTypes = aiSchema.contentTypes || []
        singleTypes = aiSchema.singleTypes || []
        components = aiSchema.components || []
        
        console.log(`[Provisioning] AI designed: ${contentTypes.length} Content Types, ${singleTypes.length} Single Types, ${components.length} Components`)
      } catch (aiError) {
        console.error("[Provisioning] AI Design failed, falling back to basic blog", aiError)
        const kit = STARTER_KITS.blog
        contentTypes = kit.contentTypes
        singleTypes = kit.singleTypes
        components = kit.components
      }
    }

    // 3. Create Components
    for (const comp of components) {
      await tenantDb.component.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: comp.slug
          }
        },
        update: {},
        create: {
          tenantId,
          name: comp.name,
          slug: comp.slug,
          category: comp.category || "General",
          fields: {
            create: comp.fields.map((f: any, idx: number) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: !!f.required,
              order: idx,
              options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || {}),
            }))
          }
        }
      })
    }

    // 4. Create Collection Types
    for (const ct of contentTypes) {
      const contentType = await tenantDb.contentType.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: ct.slug
          }
        },
        update: {},
        create: {
          tenantId,
          name: ct.name,
          slug: ct.slug,
          description: ct.description || "",
          isPublished: true,
          fields: {
            create: ct.fields.map((f: any, idx: number) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: !!f.required,
              order: idx,
              relationSlug: f.relationSlug || null,
              options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || {}),
            }))
          }
        }
      })

      await tenantDb.tenantContentTypeAssignment.upsert({
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

    // 5. Create Single Types
    for (const st of singleTypes) {
      const singleType = await tenantDb.singleType.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: st.slug
          }
        },
        update: {},
        create: {
          tenantId,
          name: st.name,
          slug: st.slug,
          description: st.description || "",
          isPublished: true,
          fields: {
            create: st.fields.map((f: any, idx: number) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: !!f.required,
              order: idx,
              options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || {}),
            }))
          }
        }
      })

      // Set initial data for site identity types
      const initialData: any = {}
      if (st.slug.includes("identity") || st.slug.includes("site") || st.slug.includes("setting")) {
        initialData.brandName = tenant.name
        initialData.siteName = tenant.name
      }

      await tenantDb.tenantSingleTypeAssignment.upsert({
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

    console.log(`[Provisioning] Completed for tenant: ${tenantId}`)
    return true
  } catch (error) {
    console.error(`[Provisioning] Failed for tenant: ${tenantId}`, error)
    return false
  }
}
