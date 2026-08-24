import { NextResponse } from "next/server"

export function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }

  const headerKeys = Array.from(req.headers.keys())
  const headersObj: Record<string, string> = {}
  headerKeys.forEach(k => headersObj[k] = req.headers.get(k) || "")
  
  return NextResponse.json({
    url: req.url,
    headers: headersObj
  })
}
