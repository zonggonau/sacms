import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs/openapi.yaml")
    const yamlContent = fs.readFileSync(filePath, "utf8")

    return new Response(yamlContent, {
      headers: {
        "Content-Type": "text/yaml",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to load OpenAPI spec" }, { status: 500 })
  }
}
