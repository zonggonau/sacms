import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Setting up WhatsApp Config Model...")

  // 1. Create Content Type
  const waConfig = await prisma.contentType.upsert({
    where: { slug: "platform-whatsapp" },
    update: {},
    create: {
      tenantId: null, // Global Super Admin
      name: "WhatsApp Config",
      slug: "platform-whatsapp",
      description: "Floating WhatsApp chat widget configuration",
      isPublished: true,
      fields: {
        create: [
          { name: "Phone Number", slug: "phone", type: "text", required: true, order: 0 },
          { name: "Initial Message", slug: "message", type: "textarea", required: false, order: 1 },
          { name: "Button Label", slug: "label", type: "text", required: false, order: 2 },
          { name: "Is Active", slug: "is_active", type: "boolean", required: true, order: 3 },
        ]
      }
    }
  })

  // 2. Seed Initial Data (Linking to first tenant like before)
  const tenant = await prisma.tenant.findFirst()
  if (tenant) {
    await prisma.contentEntry.create({
      data: {
        contentTypeId: waConfig.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: {
          phone: "6281234567890",
          message: "Halo SaCMS, saya ingin tanya seputar layanan headless CMS.",
          label: "Chat with us",
          is_active: true
        }
      }
    })
  }

  console.log("✅ WhatsApp Configuration is ready!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
