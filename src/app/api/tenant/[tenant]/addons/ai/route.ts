import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params: _params }: { params: Promise<{ tenant: string }> }
) {
  return NextResponse.json(
    {
      error: "This legacy mock endpoint has been retired. Use /api/tenant/{tenant}/ai/smart-fill.",
    },
    { status: 410 }
  )
}
