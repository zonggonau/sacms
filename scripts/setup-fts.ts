import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function setupFTS() {
  console.log("🚀 Setting up PostgreSQL Full-Text Search (FTS)...")

  try {
    // 1. Create the function to update search vector
    // This function extracts all text values from the JSON 'data' field
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION content_entry_search_trigger() RETURNS trigger AS $$
      BEGIN
        -- We convert the JSON data to text and use it for the search vector
        -- You can customize this to only index specific fields if needed
        NEW."searchVector" := to_tsvector('english', 
          coalesce(NEW.data::text, '')
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `)
    console.log("✅ Created/Updated search trigger function.")

    // 2. Create the trigger on ContentEntry table
    // We drop it first to avoid duplicates
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_content_entry_search ON "content_entries";
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_content_entry_search
      BEFORE INSERT OR UPDATE ON "content_entries"
      FOR EACH ROW EXECUTE FUNCTION content_entry_search_trigger();
    `)
    console.log("✅ Created trigger for automatic search vector updates.")

    // 3. Create GIN index for high-performance searching
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_content_entry_search_vector 
      ON "content_entries" USING GIN ("searchVector");
    `)
    console.log("✅ Created GIN index for search vector.")

    // 4. Perform an initial update for all existing records
    console.log("⏳ Re-indexing existing entries (this may take a while)...")
    await prisma.$executeRawUnsafe(`
      UPDATE "content_entries" SET "updatedAt" = NOW();
    `)
    console.log("✅ Re-indexing complete.")

    console.log("\n✨ Full-Text Search is now ACTIVE and optimized!")
    
  } catch (error) {
    console.error("❌ Failed to setup FTS:", error)
  } finally {
    await prisma.$disconnect()
  }
}

setupFTS()
