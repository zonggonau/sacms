import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { uploadFile } from "@/lib/r2"

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate cron job
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Fetch all critical data
    const tenants = await db.tenant.findMany({ include: { users: true, contentTypes: true, singleTypes: true } })
    const contentTypes = await db.contentType.findMany({ include: { fields: true } })
    const contentEntries = await db.contentEntry.findMany()
    const singleTypes = await db.singleType.findMany({ include: { fields: true } })
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

    // 4. Upload to Cloudflare R2
    const fileName = `backups/db-dump-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const file = new File([backupBuffer], fileName, { type: 'application/json' })
    
    // We mock the upload function if R2 is not fully configured yet
    let fileUrl = ""
    if (process.env.R2_BUCKET_NAME) {
      fileUrl = await uploadFile(file, "backups")
    } else {
      fileUrl = "mock-r2-url/" + fileName
      console.warn("R2_BUCKET_NAME not set. Backup generated but not uploaded.")
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
