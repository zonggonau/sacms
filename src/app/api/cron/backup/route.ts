import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { uploadToR2, uploadToLocal, isR2Configured } from "@/lib/r2"
import { authorizeCronRequest } from "@/lib/cron-auth"

export async function GET(request: NextRequest) {
  try {
    const unauthorized = authorizeCronRequest(request)
    if (unauthorized) return unauthorized

    // 2. Fetch all critical data
    const tenants = await db.tenant.findMany({ include: { members: true, contentTypes: true, singleTypes: true } })
    const contentTypes = await db.contentType.findMany({ include: { schemaFields: true } })
    const contentEntries = await db.contentEntry.findMany()
    const singleTypes = await db.singleType.findMany({ include: { schemaFields: true } })
    const singleTypeAssignments = await db.tenantSingleTypeAssignment.findMany()

    // 3. Construct JSON dump
    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        tenants,
        contentTypes,
        contentEntries,
        singleTypes,
        singleTypeAssignments,
      }
    }

    const backupJson = JSON.stringify(backupData, null, 2)
    const backupBuffer = Buffer.from(backupJson, 'utf-8')

    // 4. Upload to Cloudflare R2 or Local Storage fallback
    const fileName = `db-dump-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    
    let fileUrl = ""
    if (isR2Configured()) {
      const uploadResult = await uploadToR2("backups", backupBuffer, fileName, "application/json")
      fileUrl = uploadResult.url
    } else {
      const uploadResult = await uploadToLocal("backups", backupBuffer, fileName, "application/json")
      fileUrl = uploadResult.url
      console.warn("R2 not configured. Backup saved to local storage.")
    }

    return NextResponse.json({
      success: true,
      message: "Database backup completed",
      url: fileUrl,
      size: backupBuffer.length
    })
  } catch (error) {
    console.error("Backup Cron Error:", error)
    return NextResponse.json(
      { error: "Internal server error during backup" },
      { status: 500 }
    )
  }
}
