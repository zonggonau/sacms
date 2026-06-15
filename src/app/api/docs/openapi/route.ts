import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs", "openapi.yaml")
    const fileContent = await fs.readFile(filePath, "utf-8")
    
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "application/x-yaml",
      },
    })
  } catch (error) {
    console.error("Error reading openapi.yaml:", error)
    return new NextResponse("Not Found", { status: 404 })
  }
}
