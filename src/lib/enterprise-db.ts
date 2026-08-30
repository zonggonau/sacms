import { exec } from "child_process"
import { promisify } from "util"
import { PrismaClient } from "@prisma/client"
import { db } from "./database"

const execAsync = promisify(exec)

/**
 * Strict validation for database names.
 * Only lowercase alphanumeric and underscore allowed. Max 63 chars (PostgreSQL limit).
 */
const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

function sanitizeDbName(slug: string): string {
  const dbName = `sacms_tenant_${slug.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`
  if (!DB_NAME_REGEX.test(dbName)) {
    throw new Error(`Invalid database name derived from slug: "${slug}". Only lowercase alphanumeric and underscores are allowed.`)
  }
  return dbName
}

/**
 * Enterprise Database Provisioning Utility
 */
export async function provisionEnterpriseDb(tenantSlug: string) {
  // 1. Prepare Database Name and URL (validated)
  const dbName = sanitizeDbName(tenantSlug)
  
  // Get base connection string from environment (without the database name)
  // Format: postgresql://user:pass@localhost:5432/main_db
  const baseUrl = process.env.DATABASE_URL?.split("/").slice(0, -1).join("/")
  if (!baseUrl) throw new Error("DATABASE_URL not found in environment")
  
  const newDbUrl = `${baseUrl}/${dbName}`

  try {
    console.log(`[Enterprise] Creating database: ${dbName}...`)
    
    // 2. Create the physical database
    // Note: CREATE DATABASE cannot run in a transaction.
    // dbName is pre-validated against DB_NAME_REGEX so interpolation is safe here.
    // PostgreSQL does not support parameterized DDL (CREATE DATABASE $1 is invalid).
    await db.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
    console.log(`  ✅ Database ${dbName} created.`)

    // 3. Push the schema to the new database
    console.log(`  🚀 Pushing schema to ${dbName}...`)
    
    // Setting DATABASE_URL and DIRECT_URL specifically for this command so Prisma doesn't fallback to master DB
    const envWithNewDb = { ...process.env, DATABASE_URL: newDbUrl, DIRECT_URL: newDbUrl }
    
    const { stdout, stderr } = await execAsync("bunx prisma db push --accept-data-loss --skip-generate", {
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

/**
 * Drop a dedicated tenant database
 */
export async function dropEnterpriseDb(databaseUrl: string) {
  try {
    // Extract database name from URL
    const rawName = databaseUrl.split("/").pop()?.split("?")[0]
    if (!rawName) throw new Error("Could not extract database name from URL")

    // Validate the extracted name to prevent injection
    const dbName = rawName
    if (!DB_NAME_REGEX.test(dbName)) {
      throw new Error(`Invalid database name extracted from URL: "${dbName}". Refusing to execute DDL.`)
    }

    console.log(`[Enterprise] Dropping database: ${dbName}...`)

    // 1. Force disconnect all users from the target database
    // Use parameterized query for the WHERE clause value
    await db.$executeRaw`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = ${dbName}
        AND pid <> pg_backend_pid();
    `

    // 2. Drop the database
    // dbName is pre-validated against DB_NAME_REGEX so interpolation is safe.
    // PostgreSQL does not support parameterized DDL (DROP DATABASE $1 is invalid).
    await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`)
    
    console.log(`  ✅ Database ${dbName} dropped.`)
    return true
  } catch (error) {
    console.error(`[Enterprise Deletion Error]`, error)
    return false
  }
}

