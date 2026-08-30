import { NextRequest } from "next/server"
import { POST as handleMediaUpload } from "../route"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  return handleMediaUpload(request, context)
}
