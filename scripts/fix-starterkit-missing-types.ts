import { PrismaClient } from "@prisma/client"
import { STARTER_KITS } from "../src/lib/starter-kits"

const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Syncing missing Starter Kit types to ALL existing tenants...")

  const tenants = await prisma.tenant.findMany()
  if (tenants.length === 0) {
    console.error("❌ No tenants found.")
    return
  }

  const kit = STARTER_KITS["sacms-starter"]
  const singleTypes = kit.singleTypes

  for (const tenant of tenants) {
    console.log(`\n--- Processing tenant: ${tenant.name} (${tenant.slug}) ---`)
    
    for (const st of singleTypes) {
      console.log(`Checking Single Type: ${st.slug}...`)
      
      // 1. Ensure Single Type exists
      let singleType = await prisma.singleType.findFirst({
        where: { tenantId: tenant.id, slug: st.slug }
      })

      if (!singleType) {
        singleType = await prisma.singleType.create({
          data: {
            tenantId: tenant.id,
            name: st.name,
            slug: st.slug,
            description: st.description || "",
            isPublished: true,
          }
        })
        console.log(`✅ Created Single Type: ${st.name} for tenant ${tenant.slug}`)
      } else {
        console.log(`ℹ️ Single Type ${st.name} already exists for tenant ${tenant.slug}`)
      }

      // 2. Sync Fields
      for (const [idx, f] of st.fields.entries()) {
        let optionsObj = {}
        try {
          optionsObj = typeof f.options === 'string' ? JSON.parse(f.options || '{}') : (f.options || {})
        } catch (e) {
          optionsObj = f.options || {}
        }
        
        if (f.componentSlug) (optionsObj as any).componentSlug = f.componentSlug

        await prisma.singleTypeField.upsert({
          where: {
            singleTypeId_slug: {
              singleTypeId: singleType.id,
              slug: f.slug
            }
          },
          update: {
            name: f.name,
            type: f.type,
            required: !!f.required,
            order: idx,
            relationSlug: f.relationSlug || null,
            options: optionsObj as any,
          },
          create: {
            singleTypeId: singleType.id,
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: !!f.required,
            order: idx,
            relationSlug: f.relationSlug || null,
            options: optionsObj as any,
          }
        })
      }
      console.log(`✅ Fields synced for ${st.name}`)

      // 3. Ensure Assignment exists
      await prisma.tenantSingleTypeAssignment.upsert({
        where: {
          tenantId_singleTypeId_locale: {
            tenantId: tenant.id,
            singleTypeId: singleType.id,
            locale: "en"
          }
        },
        update: { enabled: true },
        create: {
          tenantId: tenant.id,
          singleTypeId: singleType.id,
          enabled: true,
          data: JSON.stringify({}),
          publishedAt: new Date()
        }
      })
      console.log(`✅ Assignment synced for ${st.name}`)
    }
  }

  console.log("\n✨ Sync complete for all tenants!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
