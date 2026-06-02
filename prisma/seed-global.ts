import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const globalTenantSlug = 'sacms-global'
  
  // 1. Get the global tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: globalTenantSlug }
  })
  
  if (!tenant) {
    throw new Error(`Tenant ${globalTenantSlug} not found!`)
  }

  console.log(`Found tenant ${tenant.slug} (${tenant.id})`)

  // 2. Assign sacms-features Content Type to sacms-global if not already assigned
  const featuresContentType = await prisma.contentType.findFirst({
    where: { slug: 'sacms-features' }
  })

  if (featuresContentType) {
    const existingAssignment = await prisma.tenantContentTypeAssignment.findUnique({
      where: {
        tenantId_contentTypeId: {
          tenantId: tenant.id,
          contentTypeId: featuresContentType.id
        }
      }
    })

    if (!existingAssignment) {
      await prisma.tenantContentTypeAssignment.create({
        data: {
          tenantId: tenant.id,
          contentTypeId: featuresContentType.id,
          enabled: true
        }
      })
      console.log('Assigned sacms-features ContentType to sacms-global')
    } else {
      console.log('sacms-features ContentType already assigned')
    }
  } else {
    console.warn('ContentType sacms-features not found')
  }

  // 3. Update Hero Single Type Data
  const heroSingleType = await prisma.singleType.findFirst({
    where: { slug: 'sacms-hero' }
  })

  if (heroSingleType) {
    await prisma.tenantSingleTypeAssignment.upsert({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: tenant.id,
          singleTypeId: heroSingleType.id,
          locale: 'en'
        }
      },
      create: {
        tenantId: tenant.id,
        singleTypeId: heroSingleType.id,
        locale: 'en',
        enabled: true,
        data: {
          headline: "Bangun Pengalaman Digital Tanpa Batas dari Papua.",
          subheadline: "Headless CMS modern dengan arsitektur multi-tenant yang dirancang untuk kecepatan, keamanan, dan kemudahan skalabilitas bagi instansi dan startup.",
          cta_primary: "Mulai Gratis",
          cta_secondary: "Lihat Demo",
          badge_text: "SaCMS v1.0",
          image_url: ""
        },
        publishedAt: new Date()
      },
      update: {
        data: {
          headline: "Bangun Pengalaman Digital Tanpa Batas dari Papua.",
          subheadline: "Headless CMS modern dengan arsitektur multi-tenant yang dirancang untuk kecepatan, keamanan, dan kemudahan skalabilitas bagi instansi dan startup.",
          cta_primary: "Mulai Gratis",
          cta_secondary: "Lihat Demo",
          badge_text: "SaCMS v1.0",
          image_url: ""
        },
        publishedAt: new Date()
      }
    })
    console.log('Updated sacms-hero SingleType data')
  }

  // 4. Seed Features Content Entries
  if (featuresContentType) {
    const features = [
      {
        title: "Multi-Tenant Native",
        description: "Isolasi data yang aman untuk berbagai workspace (organisasi) dalam satu aplikasi tunggal. Anda dapat mengelola puluhan klien tanpa bentrok data.",
        icon: "Database"
      },
      {
        title: "AI Content Generator",
        description: "Diintegrasikan dengan AI (DeepSeek & OpenAI), pembuat konten dapat menulis draft, menerjemahkan bahasa, atau menghasilkan kerangka posting.",
        icon: "Brain"
      },
      {
        title: "Dynamic GraphQL & REST",
        description: "Begitu struktur Content Type dibuat, SaCMS otomatis melahirkan endpoint REST dan skema GraphQL khusus.",
        icon: "Webhook"
      },
      {
        title: "Media Library & R2",
        description: "Sistem penyimpanan aset yang aman. Mendukung unggahan berbagai format file yang diamankan langsung dengan Cloudflare R2.",
        icon: "Cloud"
      },
      {
        title: "Real-time Webhooks & Sync",
        description: "Integrasi tanpa hambatan. Memicu webhooks asinkron untuk membangun ulang frontend Vercel/Netlify pengguna secara otomatis.",
        icon: "Zap"
      },
      {
        title: "Sistem Filtering Canggih",
        description: "Public API dilengkapi filter mirip operator basis data, memudahkan developer frontend mengambil irisan data yang akurat.",
        icon: "Layout"
      }
    ]

    // Clear existing features to prevent duplicates on multiple runs
    await prisma.contentEntry.deleteMany({
      where: {
        tenantId: tenant.id,
        contentTypeId: featuresContentType.id
      }
    })

    let createdCount = 0
    for (const feature of features) {
      await prisma.contentEntry.create({
        data: {
          tenantId: tenant.id,
          contentTypeId: featuresContentType.id,
          locale: 'en',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          data: feature
        }
      })
      createdCount++
    }
    console.log(`Created ${createdCount} features for sacms-features`)
  }

  console.log('Global data seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
