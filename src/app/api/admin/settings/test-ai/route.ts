import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json()
    const { apiKey, baseUrl } = body

    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API Key tidak boleh kosong." }, { status: 400 })
    }

    const url = (baseUrl || "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "")
    const res = await fetch(`${url}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      return NextResponse.json({ success: true, message: "Koneksi Vercel AI Gateway berhasil diverifikasi! Seluruh model AI siap diakses." })
    }

    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ success: false, message: `Gateway error: ${err.error?.message || res.statusText}` }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menghubungi Vercel AI Gateway." }, { status: 500 })
  }
})
