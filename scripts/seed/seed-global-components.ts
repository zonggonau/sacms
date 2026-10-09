import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Global Components...\n')

  const globalComponents = [
    {
      name: 'Hero Section',
      slug: 'hero-section',
      description: 'Main hero banner with title, description and call to action',
      category: 'Layout',
      fields: [
        { name: 'Title', slug: 'title', type: 'text', required: true, order: 1 },
        { name: 'Subtitle', slug: 'subtitle', type: 'textarea', required: false, order: 2 },
        { name: 'Background Image', slug: 'bg_image', type: 'media', required: true, order: 3 },
        { name: 'Button Text', slug: 'cta_text', type: 'text', required: false, order: 4 },
        { name: 'Button Link', slug: 'cta_link', type: 'text', required: false, order: 5 },
      ]
    },
    {
      name: 'SEO Metadata',
      slug: 'seo-metadata',
      description: 'Search Engine Optimization fields',
      category: 'System',
      fields: [
        { name: 'Meta Title', slug: 'meta_title', type: 'text', required: true, order: 1 },
        { name: 'Meta Description', slug: 'meta_description', type: 'textarea', required: true, order: 2 },
        { name: 'Keywords', slug: 'keywords', type: 'text', required: false, order: 3 },
        { name: 'OG Image', slug: 'og_image', type: 'media', required: false, order: 4 },
      ]
    },
    {
      name: 'Feature Card',
      slug: 'feature-card',
      description: 'Card highlighting a specific feature or service',
      category: 'UI',
      fields: [
        { name: 'Icon', slug: 'icon', type: 'media', required: false, order: 1 },
        { name: 'Title', slug: 'title', type: 'text', required: true, order: 2 },
        { name: 'Description', slug: 'description', type: 'textarea', required: true, order: 3 },
      ]
    }
  ]

  for (const compData of globalComponents) {
    const { fields, ...componentInfo } = compData

    // Check if component already exists
    const existing = await prisma.component.findUnique({
      where: { slug: componentInfo.slug }
    })

    if (existing) {
      console.log(`⚠️  Component "${componentInfo.name}" already exists, skipping...`)
      continue
    }

    // Create Component
    const component = await prisma.component.create({
      data: componentInfo
    })

    console.log(`✅ Created Component: ${component.name} (${component.slug})`)

    // Create Fields
    for (const field of fields) {
      await prisma.componentField.create({
        data: {
          componentId: component.id,
          ...field
        }
      })
      console.log(`   - Added Field: ${field.name} (${field.slug})`)
    }
  }

  // Optional: Assign to demo tenant if it exists
  const demoTenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: 'demo' }, { slug: 'cc29bc2250' }] }
  })

  if (demoTenant) {
    console.log(`\n🔗 Assigning components to tenant: ${demoTenant.name}...`)
    const components = await prisma.component.findMany()
    
    for (const comp of components) {
      const existingAssignment = await prisma.tenantComponentAssignment.findUnique({
        where: {
          tenantId_componentId: {
            tenantId: demoTenant.id,
            componentId: comp.id
          }
        }
      })

      if (!existingAssignment) {
        await prisma.tenantComponentAssignment.create({
          data: {
            tenantId: demoTenant.id,
            componentId: comp.id,
            enabled: true
          }
        })
        console.log(`   ✅ Assigned ${comp.name} to ${demoTenant.slug}`)
      }
    }
  }

  console.log('\n✨ Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
