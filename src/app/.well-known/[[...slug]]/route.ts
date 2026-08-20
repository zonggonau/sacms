import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ error: "oauth_not_supported" }, { status: 404 })
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  })
}
