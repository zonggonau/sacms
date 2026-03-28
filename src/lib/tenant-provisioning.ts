import { db } from "./database"

/**
 * Starter Kit Definition
 */
const STARTER_CONTENT_TYPES = [
  {
    name: "Categories",
    slug: "categories",
    description: "Group your content into logical categories",
    fields: [
      { name: "Name", slug: "name", type: "text", required: true },
      { name: "Slug", slug: "slug", type: "uid", required: true },
      { name: "Description", slug: "description", type: "textarea", required: false },
    ]
  },
  {
    name: "Blog Posts",
    slug: "posts",
    description: "Standard blog post with rich text and SEO",
    fields: [
      { name: "Title", slug: "title", type: "text", required: true },
      { name: "Slug", slug: "slug", type: "uid", required: true },
      { name: "Summary", slug: "summary", type: "textarea", required: true },
      { name: "Content", slug: "content", type: "richText", required: true },
      { name: "Category", slug: "category", type: "relation", relationSlug: "categories", required: false },
      { name: "Reading Time", slug: "readingTime", type: "integer", required: false },
      { name: "Featured Image", slug: "featuredImage", type: "media", required: false },
      { name: "Featured", slug: "isFeatured", type: "boolean", required: false },
      { name: "Tags", slug: "tags", type: "json", required: false },
      { name: "SEO Title", slug: "seoTitle", type: "text", required: false },
      { name: "SEO Description", slug: "seoDescription", type: "textarea", required: false },
    ]
  }
]

const STARTER_SINGLE_TYPES = [
  {
    name: "Site Settings",
    slug: "identity",
    description: "Global site identity and metadata",
    fields: [
      { name: "Site Name", slug: "siteName", type: "text", required: true },
      { name: "Site Description", slug: "siteDescription", type: "textarea", required: false },
      { name: "Favicon", slug: "favicon", type: "media", required: false },
    ]
  },
  {
    name: "Main Navigation",
    slug: "navbar",
    description: "Configure your site's top menu",
    fields: [
      { name: "Menu Links", slug: "links", type: "json", required: true },
      { name: "Show Login Button", slug: "showLogin", type: "boolean", required: false },
    ]
  },
  {
    name: "Footer",
    slug: "footer",
    description: "Manage your site's footer content and social links",
    fields: [
      { name: "Copyright Text", slug: "copyright", type: "text", required: true },
      { name: "Social Links", slug: "socialLinks", type: "json", required: false },
      { name: "Footer Description", slug: "description", type: "textarea", required: false },
    ]
  }
]

/**
 * Provision a new tenant with starter content types and demo data
 */
export async function provisionTenant(tenantId: string) {
  try {
    console.log(`[Provisioning] Starting for tenant: ${tenantId}`)

    // 1. Create Collection Types
    for (const ct of STARTER_CONTENT_TYPES) {
      const contentType = await db.contentType.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: ct.slug
          }
        },
        update: {},
        create: {
          tenantId, // Ownership
          name: ct.name,
          slug: ct.slug,
          description: ct.description,
          isPublished: true,
          fields: {
            create: ct.fields.map((f, idx) => ({
              ...f,
              order: idx,
              options: JSON.stringify({}),
            }))
          }
        }
      })

      // Link to tenant assignment
      await db.tenantContentTypeAssignment.upsert({
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

      // 2. Add Demo Data
      if (ct.slug === "categories") {
        const existingCat = await db.contentEntry.findFirst({
          where: { tenantId, contentTypeId: contentType.id }
        })
        
        if (!existingCat) {
          const cat = await db.contentEntry.create({
            data: {
              tenantId,
              contentTypeId: contentType.id,
              status: "PUBLISHED",
              publishedAt: new Date(),
              data: JSON.stringify({
                name: "Tech & Innovation",
                slug: "tech-innovation",
                description: "The latest updates from the tech world."
              })
            }
          })
          process.env[`TEMP_CAT_ID_${tenantId}`] = cat.id
        }
      }

      if (ct.slug === "posts") {
        const existingPost = await db.contentEntry.findFirst({
          where: { tenantId, contentTypeId: contentType.id }
        })

        if (!existingPost) {
          const catId = process.env[`TEMP_CAT_ID_${tenantId}`]
          await db.contentEntry.create({
            data: {
              tenantId,
              contentTypeId: contentType.id,
              status: "PUBLISHED",
              publishedAt: new Date(),
              data: JSON.stringify({
                title: "Welcome to your Professional CMS!",
                slug: "welcome-professional-cms",
                summary: "A quick guide to help you get started with your new multi-tenant workspace.",
                content: "<h1>Welcome!</h1><p>Your workspace is now equipped with a professional content structure.</p>",
                category: catId || null,
                tags: ["welcome", "workspace"],
                readingTime: 5,
                isFeatured: true,
                seoTitle: "Welcome to SACMS",
                seoDescription: "Modern multi-tenant headless CMS."
              })
            }
          })
        }
      }
    }

    // 3. Create Single Types
    for (const st of STARTER_SINGLE_TYPES) {
      const singleType = await db.singleType.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: st.slug
          }
        },
        update: {},
        create: {
          tenantId, // Ownership!
          name: st.name,
          slug: st.slug,
          description: st.description,
          isPublished: true,
          fields: {
            create: st.fields.map((f, idx) => ({
              ...f,
              order: idx,
              options: JSON.stringify({}),
            }))
          }
        }
      })

      const initialData: any = {}
      if (st.slug === "identity") {
        initialData.siteName = "My Workspace"
        initialData.siteDescription = "Powered by SACMS"
      }
      if (st.slug === "navbar") {
        initialData.links = [{ label: "Home", url: "/" }, { label: "Blog", url: "/blog" }]
        initialData.showLogin = true
      }
      if (st.slug === "footer") {
        initialData.copyright = `© ${new Date().getFullYear()} My Workspace. All rights reserved.`
        initialData.socialLinks = [
          { platform: "Twitter", url: "https://twitter.com" },
          { platform: "GitHub", url: "https://github.com" }
        ]
        initialData.description = "Built with SaCMS - The first Headless CMS from Papua."
      }

      await db.tenantSingleTypeAssignment.upsert({
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
