import { exec } from "child_process"
import { promisify } from "util"
import { PrismaClient } from "@prisma/client"
import { db } from "./database"

const execAsync = promisify(exec)

/**
 * Enterprise Database Provisioning Utility
 */
export async function provisionEnterpriseDb(tenantSlug: string) {
  // 1. Prepare Database Name and URL
  // We use the slug as the DB name (sanitized)
  const dbName = `sacms_tenant_${tenantSlug.replace(/-/g, "_")}`
  
  // Get base connection string from environment (without the database name)
  // Format: postgresql://user:pass@localhost:5432/main_db
  const baseUrl = process.env.DATABASE_URL?.split("/").slice(0, -1).join("/")
  if (!baseUrl) throw new Error("DATABASE_URL not found in environment")
  
  const newDbUrl = `${baseUrl}/${dbName}`

  try {
    console.log(`[Enterprise] Creating database: ${dbName}...`)
    
    // 2. Create the physical database
    // Note: CREATE DATABASE cannot run in a transaction. 
    // We use the master DB client to execute raw SQL.
    await db.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
    console.log(`  ✅ Database ${dbName} created.`)

    // 3. Push the schema to the new database
    // We use npx prisma db push to ensure the tables are created
    console.log(`  🚀 Pushing schema to ${dbName}...`)
    
    // Setting DATABASE_URL specifically for this command
    const envWithNewDb = { ...process.env, DATABASE_URL: newDbUrl }
    
    const { stdout, stderr } = await execAsync("npx prisma db push --accept-data-loss", {
      env: envWithNewDb
    })
    
    if (stderr && !stderr.includes("Your database is now in sync")) {
      console.warn(`[Enterprise Schema Warning] ${stderr}`)
    }
    
    console.log(`  ✅ Schema initialized for ${dbName}.`)
    
    return newDbUrl
  } catch (error: any) {
    console.error(`[Enterprise Provisioning Error]`, error)
    
    // Cleanup: try to drop if partially created (optional, be careful)
    throw error
  }
}
