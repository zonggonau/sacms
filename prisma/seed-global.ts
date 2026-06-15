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
          headline: "Modernisasi Digital untuk Tanah Papua",
          subheadline: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung percepatan transformasi digital di Tanah Papua.",
          cta_primary: "Mulai Sekarang",
          cta_secondary: "Pelajari Selengkapnya",
          badge_text: "🏛️ Platform Digital Papua — Khusus Website Pemerintah",
          image_url: ""
        },
        publishedAt: new Date()
      },
      update: {
        data: {
          headline: "Modernisasi Digital untuk Tanah Papua",
          subheadline: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung percepatan transformasi digital di Tanah Papua.",
          cta_primary: "Mulai Sekarang",
          cta_secondary: "Pelajari Selengkapnya",
          badge_text: "🏛️ Platform Digital Papua — Khusus Website Pemerintah",
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
        title: "Website Pemerintah",
        description: "Template dan sistem siap pakai untuk instansi pemerintah daerah di Papua. Mendukung transparansi informasi publik, pengumuman resmi, dan layanan masyarakat secara digital.",
        icon: "Shield"
      },
      {
        title: "Portal Berita & Blog",
        description: "Sistem publikasi berita dan blog profesional untuk media lokal Papua. Dilengkapi kategori, penulis, penjadwalan publikasi, dan SEO otomatis.",
        icon: "Zap"
      },
      {
        title: "Katalog UMKM & Produk",
        description: "Etalase digital untuk wirausaha dan UMKM Papua. Tampilkan produk lokal, harga, dan informasi usaha kepada pasar yang lebih luas.",
        icon: "Layout"
      },
      {
        title: "Pariwisata Papua",
        description: "Showcase destinasi wisata dan kekayaan budaya Papua — dari Raja Ampat hingga Lembah Baliem. Website wisata yang memukau untuk menarik wisatawan.",
        icon: "Globe"
      },
      {
        title: "Profil Bisnis & Cafe",
        description: "Website profesional untuk usaha kecil dan menengah: cafe, restoran, toko, dan layanan jasa di seluruh Papua. Tampil modern dan mudah dikelola.",
        icon: "CreditCard"
      },
      {
        title: "Keamanan & Keandalan",
        description: "Infrastruktur enterprise-grade dengan enkripsi data, kontrol akses berbasis peran (RBAC), audit log, dan backup otomatis. Aman untuk data pemerintah dan bisnis.",
        icon: "Database"
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
