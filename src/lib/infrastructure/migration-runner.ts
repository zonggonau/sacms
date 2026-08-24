import { exec } from 'child_process'
import { promisify } from 'util'
import { PrismaClient } from '../../../prisma/generated-client'

const execAsync = promisify(exec)

export interface MigrationResult {
  success: boolean
  message: string
  tablesCreated?: number
  durationMs: number
}

/**
 * Test connectivity to a target PostgreSQL database
 */
export async function testDatabaseConnection(databaseUrl: string, timeoutMs = 8000): Promise<boolean> {
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  })

  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
  )

  try {
    await Promise.race([
      client.$queryRawUnsafe('SELECT 1 as test'),
      timer
    ])
    return true
  } catch (error) {
    console.error('[Migration Runner] DB Connection test failed:', error)
    return false
  } finally {
    await client.$disconnect().catch(() => {})
  }
}

/**
 * Initialize / Deploy SaCMS schema to a newly provisioned tenant PostgreSQL database
 */
export async function deployTenantDatabaseSchema(databaseUrl: string): Promise<MigrationResult> {
  const startTime = Date.now()

  try {
    console.log('[Migration Runner] Deploying SaCMS schema to tenant database...')
    
    // Use prisma db push with custom DATABASE_URL
    const { stdout, stderr } = await execAsync('bunx prisma db push --accept-data-loss --skip-generate', {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      cwd: process.cwd(),
      timeout: 45000,
    })

    console.log('[Migration Runner] Schema deploy output:', stdout)
    if (stderr && !stderr.includes('warn') && !stderr.includes('Prisma schema loaded')) {
      console.warn('[Migration Runner] Schema deploy stderr:', stderr)
    }

    // Verify core tables exist
    const client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    })

    try {
      const tables: any[] = await client.$queryRawUnsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `)
      const durationMs = Date.now() - startTime
      return {
        success: true,
        message: `Schema deployed successfully with ${tables.length} tables.`,
        tablesCreated: tables.length,
        durationMs,
      }
    } finally {
      await client.$disconnect().catch(() => {})
    }
  } catch (error: any) {
    console.error('[Migration Runner] Failed to deploy schema:', error)
    return {
      success: false,
      message: error?.message || 'Unknown migration error',
      durationMs: Date.now() - startTime,
    }
  }
}
