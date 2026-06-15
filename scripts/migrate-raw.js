
const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  console.log("🚀 Starting RAW SQL migration from 'sacms-global' to 'Global Content'...");
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    // 1. Find sacms-global tenant ID
    const res = await client.query("SELECT id FROM tenants WHERE slug = 'sacms-global'");
    if (res.rows.length === 0) {
      console.log("❌ sacms-global tenant not found.");
      return;
    }
    const tId = res.rows[0].id;
    console.log(`- Found sacms-global ID: ${tId}`);

    // 2. Perform migrations
    console.log("- Migrating Content Types...");
    await client.query('UPDATE content_types SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);

    console.log("- Migrating Single Types...");
    await client.query('UPDATE single_types SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);

    console.log("- Migrating Components...");
    await client.query('UPDATE components SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);

    console.log("- Migrating Content Entries...");
    await client.query('UPDATE content_entries SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);

    console.log("- Migrating Assignments...");
    await client.query('UPDATE tenant_content_type_assignments SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);
    await client.query('UPDATE tenant_single_type_assignments SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);
    await client.query('UPDATE tenant_component_assignments SET "tenantId" = NULL WHERE "tenantId" = $1', [tId]);

    console.log("✅ Migration complete! sacms-global data is now Truly Global.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
