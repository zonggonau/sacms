import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Adjusting Startup Management Data to match current landing page...")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ No tenant found. Please register first.")
    return
  }

  const getCT = async (slug: string) => {
    const ct = await prisma.contentType.findUnique({ where: { slug } })
    if (!ct) throw new Error(`Content Type ${slug} not found`)
    return ct
  }

  try {
    // 1. Membersihkan data lama untuk model ini (agar tidak duplikat)
    const ctIds = await prisma.contentType.findMany({
      where: { slug: { in: ["lp-config", "platform-features", "platform-pricing", "platform-testimonials"] } },
      select: { id: true }
    })
    await prisma.contentEntry.deleteMany({
      where: { contentTypeId: { in: ctIds.map(c => c.id) }, tenantId: tenant.id }
    })

    // --- 1. LANDING PAGE CONFIG ---
    const ctLp = await getCT("lp-config")
    await prisma.contentEntry.create({
      data: {
        contentTypeId: ctLp.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: {
          hero_title: "The Headless CMS Strapi Can't Be",
          hero_subtitle: "Native multi-tenancy, content workflow, i18n, and billing built-in. REST + GraphQL APIs with advanced filtering. Deploy in minutes.",
          cta_text: "Start Building Free",
          cta_link: "/register"
        }
      }
    })

    // --- 2. PLATFORM FEATURES ---
    const ctFeatures = await getCT("platform-features")
    const features = [
      { title: "Content Workflow", description: "Draft → Review → Publish → Archive. Full editorial workflow with scheduled publishing.", icon: "GitBranch", order: 1 },
      { title: "i18n Native", description: "Built-in multi-language support. Manage localized content with locale switcher.", icon: "Languages", order: 2 },
      { title: "Multi-Tenant Native", description: "Isolated workspaces per team. The only headless CMS with native multi-tenancy.", icon: "Users", order: 3 },
      { title: "REST + GraphQL", description: "Auto-generated APIs with advanced filtering and relation population.", icon: "Code2", order: 4 },
      { title: "Full-Text Search", description: "PostgreSQL-powered full-text search with relevance ranking.", icon: "Search", order: 5 },
      { title: "Cloud Media (R2)", description: "Cloudflare R2 storage with auto-generated thumbnails and zero egress fees.", icon: "Cloud", order: 6 }
    ]
    for (const f of features) {
      await prisma.contentEntry.create({
        data: { contentTypeId: ctFeatures.id, tenantId: tenant.id, status: "PUBLISHED", data: f }
      })
    }

    // --- 3. PRICING PLANS ---
    const ctPricing = await getCT("platform-pricing")
    const plans = [
      { name: "Starter", price: 0, is_popular: false, features: JSON.stringify(["1 Workspace", "5 Content Types", "1,000 Entries", "1GB Media Storage"]) },
      { name: "Pro", price: 299000, is_popular: true, features: JSON.stringify(["Unlimited Workspaces", "Unlimited Content Types", "50,000 Entries", "50GB Media Storage", "Content Workflow"]) },
      { name: "Enterprise", price: 0, is_popular: false, features: JSON.stringify(["Everything in Pro", "Unlimited Storage", "Unlimited Locales", "White-Label Domains", "SSO / SAML"]) }
    ]
    for (const p of plans) {
      await prisma.contentEntry.create({
        data: { contentTypeId: ctPricing.id, tenantId: tenant.id, status: "PUBLISHED", data: p }
      })
    }

    // --- 4. TESTIMONIALS ---
    const ctTesti = await getCT("platform-testimonials")
    await prisma.contentEntry.create({
      data: {
        contentTypeId: ctTesti.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: {
          name: "CEO of Tech Papua",
          company: "Papua Startup",
          quote: "SaCMS is the missing piece in our multi-tenant architecture. It's incredibly fast and flexible.",
          rating: 5
        }
      }
    })

    console.log("✅ Data successfully matched with current Landing Page!")
  } catch (err: any) {
    console.error(`❌ Error seeding: ${err.message}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
