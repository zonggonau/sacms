/**
 * Script: Migrate old field models to Unified SchemaField
 * Run: npx tsx scripts/migrate-fields.ts
 */

import { PrismaClient } from "../prisma/generated-client"

const db = new PrismaClient()

async function main() {
  console.log("🚀 Starting field migration...")

  // 1. Migrate ContentTypeField
  const ctFields = await db.contentTypeField.findMany()
  console.log(`📦 Found ${ctFields.length} ContentTypeFields`)
  
  for (const field of ctFields) {
    await db.schemaField.upsert({
      where: { 
        contentTypeId_slug: { 
          contentTypeId: field.contentTypeId, 
          slug: field.slug 
        } 
      },
      update: {
        name: field.name,
        type: field.type,
        required: field.required,
        unique: field.unique,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        options: field.options || {},
      },
      create: {
        name: field.name,
        slug: field.slug,
        type: field.type,
        required: field.required,
        unique: field.unique,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        options: field.options || {},
        contentTypeId: field.contentTypeId,
      }
    })
  }

  // 2. Migrate SingleTypeField
  const stFields = await db.singleTypeField.findMany()
  console.log(`📦 Found ${stFields.length} SingleTypeFields`)
  
  for (const field of stFields) {
    await db.schemaField.upsert({
      where: { 
        singleTypeId_slug: { 
          singleTypeId: field.singleTypeId, 
          slug: field.slug 
        } 
      },
      update: {
        name: field.name,
        type: field.type,
        required: field.required,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        unique: field.unique,
        options: field.options || {},
      },
      create: {
        name: field.name,
        slug: field.slug,
        type: field.type,
        required: field.required,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        unique: field.unique,
        options: field.options || {},
        singleTypeId: field.singleTypeId,
      }
    })
  }

  // 3. Migrate ComponentField
  const compFields = await db.componentField.findMany()
  console.log(`📦 Found ${compFields.length} ComponentFields`)
  
  for (const field of compFields) {
    await db.schemaField.upsert({
      where: { 
        componentId_slug: { 
          componentId: field.componentId, 
          slug: field.slug 
        } 
      },
      update: {
        name: field.name,
        type: field.type,
        required: field.required,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        unique: field.unique,
        options: field.options || {},
      },
      create: {
        name: field.name,
        slug: field.slug,
        type: field.type,
        required: field.required,
        order: field.order,
        jsonPath: field.jsonPath,
        localizable: field.localizable,
        relationSlug: field.relationSlug,
        unique: field.unique,
        options: field.options || {},
        componentId: field.componentId,
      }
    })
  }

  console.log("✅ Migration completed successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
