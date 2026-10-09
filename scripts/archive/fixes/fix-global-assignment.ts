import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🔗 Mengaitkan Global Content Types ke sacms-global...")

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "sacms-global" }
  })

  if (!tenant) {
    console.error("❌ Tenant 'sacms-global' tidak ditemukan.")
    return
  }

  // Cari semua Content Type yang sifatnya global (tenantId: null)
  const globalTypes = await prisma.contentType.findMany({
    where: { tenantId: null }
  })

  console.log(`Menemukan ${globalTypes.length} global content types.`)

  for (const ct of globalTypes) {
    await prisma.tenantContentTypeAssignment.upsert({
      where: {
        tenantId_contentTypeId: {
          tenantId: tenant.id,
          contentTypeId: ct.id
        }
      },
      create: {
        tenantId: tenant.id,
        contentTypeId: ct.id,
        enabled: true
      },
      update: {
        enabled: true
      }
    })
    console.log(`  ✅ Assigned: ${ct.name}`)
  }

  // Sama halnya untuk Single Types jika ada
  const globalSingleTypes = await prisma.singleType.findMany({
    where: { tenantId: null }
  })

  for (const st of globalSingleTypes) {
    await prisma.tenantSingleTypeAssignment.upsert({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: tenant.id,
          singleTypeId: st.id,
          locale: "en"
        }
      },
      create: {
        tenantId: tenant.id,
        singleTypeId: st.id,
        locale: "en",
        enabled: true
      },
      update: {
        enabled: true
      }
    })
    console.log(`  ✅ Assigned SingleType: ${st.name}`)
  }

  console.log("✨ Semua schema global telah ditautkan ke dashboard sacms-global!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
