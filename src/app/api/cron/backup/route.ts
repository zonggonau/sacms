import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { db } from "@/lib/database"
import { uploadToR2, isR2Configured } from "@/lib/r2"
import { authorizeCronRequest } from "@/lib/cron-auth"

/**
 * GET /api/cron/backup — JSON snapshot of the platform's structural data.
 *
 * Writes to R2 when configured, otherwise to the private BACKUP_DIR volume
 * (docker-compose mounts ./db/backups → /backups). It NEVER writes under
 * public/ — that path is served statically, and a DB dump there is a public
 * download.
 *
 * The dump excludes credential columns (User.password, Member.passwordHash,
 * Tenant.databaseUrl / storageConfig, API tokens) — a structural backup, not a
 * secrets backup.
 */
const BACKUP_DIR = process.env.BACKUP_DIR || "/backups"

export async function GET(request: NextRequest) {
  try {
    const unauthorized = authorizeCronRequest(request)
    if (unauthorized) return unauthorized

    const tenants = await db.tenant.findMany({
      select: {
        id: true, slug: true, name: true, plan: true, status: true,
        createdAt: true, ownerId: true, brandName: true,
        members: { select: { userId: true, role: true, joinedAt: true } },
        contentTypes: { select: { id: true, slug: true, name: true } },
        singleTypes: { select: { id: true, slug: true, name: true } },
      },
    })
    const contentTypes = await db.contentType.findMany({ include: { schemaFields: true } })
    const contentEntries = await db.contentEntry.findMany()
    const singleTypes = await db.singleType.findMany({ include: { schemaFields: true } })
    const singleTypeAssignments = await db.tenantSingleTypeAssignment.findMany()

    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.1",
      data: { tenants, contentTypes, contentEntries, singleTypes, singleTypeAssignments },
    }

    const backupJson = JSON.stringify(backupData, null, 2)
    const backupBuffer = Buffer.from(backupJson, "utf-8")
    const fileName = `db-dump-${new Date().toISOString().replace(/[:.]/g, "-")}.json`

    let location: string
    if (await isR2Configured()) {
      const uploadResult = await uploadToR2("backups", backupBuffer, fileName, "application/json")
      location = uploadResult.url
    } else {
      await fs.mkdir(BACKUP_DIR, { recursive: true })
      const target = path.join(BACKUP_DIR, fileName)
      await fs.writeFile(target, backupBuffer)
      location = target
      console.warn(`[Backup] R2 not configured — wrote to ${BACKUP_DIR} (private volume).`)
    }

    return NextResponse.json({
      success: true,
      message: "Database backup completed",
      location,
      size: backupBuffer.length,
    })
  } catch (error) {
    console.error("Backup Cron Error:", error)
    return NextResponse.json(
      { error: "Internal server error during backup" },
      { status: 500 },
    )
  }
}
