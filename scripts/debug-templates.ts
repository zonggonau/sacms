import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Debugging Templates...")

  const templateCt = await prisma.contentType.findFirst({
    where: { slug: "templates" }
  })

  if (!templateCt) {
    console.error("❌ ContentType 'templates' NOT FOUND")
  } else {
    console.log(`✅ ContentType 'templates' found. ID: ${templateCt.id}, tenantId: ${templateCt.tenantId}, isPublished: ${templateCt.isPublished}`)
    
    const entries = await prisma.contentEntry.findMany({
      where: { contentTypeId: templateCt.id }
    })
    
    console.log(`✅ Found ${entries.length} entries for 'templates'`)
    entries.forEach((e, i) => {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      console.log(`   [${i}] Status: ${e.status}, Name: ${data.name || data.nama_template}, TemplateID: ${data.template_id}`)
    })
  }

  const apiKey = await prisma.setting.findUnique({
    where: { key: "systemApiKey" }
  })
  console.log(`✅ systemApiKey setting: ${apiKey?.value || "NOT SET"}`)

  console.log("✨ Debug complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
