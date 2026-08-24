import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { decryptCredential } from "@/lib/infrastructure/encryption"
import { checkServerHealth, restartServer, destroyServer, syncServerDns } from "@/lib/infrastructure/provisioner"
import { deployTenantDatabaseSchema, testDatabaseConnection } from "@/lib/infrastructure/migration-runner"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { id } = await params

    const server = await db.infrastructureServer.findUnique({
      where: { id },
      include: {
        tenant: true,
        credentials: true,
      }
    })

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    let decryptedInfo: any = null
    if (server.credentials) {
      try {
        decryptedInfo = {
          databaseName: server.credentials.databaseName,
          dbUser: server.credentials.dbUser,
          dbPassword: decryptCredential(server.credentials.dbPasswordEncrypted),
          minioUser: server.credentials.minioUser,
          minioSecret: decryptCredential(server.credentials.minioSecretEncrypted),
          connectionString: decryptCredential(server.credentials.connectionStringEncrypted),
          s3Endpoint: server.credentials.s3Endpoint,
          s3Bucket: server.credentials.s3Bucket,
          s3PublicUrl: server.credentials.s3PublicUrl,
        }
      } catch (e: any) {
        console.error("Failed to decrypt credentials for server:", e)
      }
    }

    return NextResponse.json({
      server: {
        ...server,
        credentials: undefined, // strip raw encrypted object
      },
      credentials: decryptedInfo,
    })
  } catch (error: any) {
    console.error("[API Admin Server GET Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const action = body.action

    if (action === "health-check") {
      const result = await checkServerHealth(id)
      return NextResponse.json(result)
    }

    if (action === "restart") {
      const ok = await restartServer(id)
      return NextResponse.json({ success: ok, message: ok ? "Restart signal sent to VPS" : "Restart failed" })
    }

    if (action === "sync-schema") {
      const server = await db.infrastructureServer.findUnique({
        where: { id },
        include: { credentials: true }
      })
      if (!server || !server.credentials) {
        return NextResponse.json({ error: "Server credentials not found" }, { status: 404 })
      }
      const rawDbUrl = decryptCredential(server.credentials.connectionStringEncrypted)
      const result = await deployTenantDatabaseSchema(rawDbUrl)
      return NextResponse.json(result)
    }

    if (action === "sync-dns") {
      const result = await syncServerDns(id)
      return NextResponse.json(result)
    }

    if (action === "test-db") {
      const server = await db.infrastructureServer.findUnique({
        where: { id },
        include: { credentials: true }
      })
      if (!server || !server.credentials) {
        return NextResponse.json({ error: "Server credentials not found" }, { status: 404 })
      }
      const rawDbUrl = decryptCredential(server.credentials.connectionStringEncrypted)
      const ok = await testDatabaseConnection(rawDbUrl, 5000)
      return NextResponse.json({ success: ok, message: ok ? "PostgreSQL database is online & accepting connections" : "PostgreSQL connection timed out or failed" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("[API Admin Server POST Action Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const ok = await destroyServer(id)

    return NextResponse.json({ success: ok, message: ok ? "Server destroyed and cleaned up" : "Destroy failed" })
  } catch (error: any) {
    console.error("[API Admin Server DELETE Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
