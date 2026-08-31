import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { provider, apiKey, model } = body

    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API Key tidak boleh kosong." }, { status: 400 })
    }

    if (provider === "deepseek") {
      const res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000)
      })
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Koneksi DeepSeek API berhasil diverifikasi!" })
      } else {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ success: false, message: `DeepSeek error: ${err.error?.message || res.statusText}` }, { status: 400 })
      }
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000)
      })
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Koneksi OpenAI API berhasil diverifikasi!" })
      } else {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ success: false, message: `OpenAI error: ${err.error?.message || res.statusText}` }, { status: 400 })
      }
    }

    if (provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        signal: AbortSignal.timeout(8000)
      })
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Koneksi Google Gemini API berhasil diverifikasi!" })
      } else {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ success: false, message: `Gemini error: ${err.error?.message || res.statusText}` }, { status: 400 })
      }
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: model || "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }]
        }),
        signal: AbortSignal.timeout(8000)
      })
      if (res.ok || res.status === 400) { // 400 with valid key still confirms auth
        return NextResponse.json({ success: true, message: "Koneksi Anthropic Claude API berhasil diverifikasi!" })
      } else {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ success: false, message: `Anthropic error: ${err.error?.message || res.statusText}` }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, message: `Koneksi ${provider} API siap digunakan.` })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menghubungi server AI." }, { status: 500 })
  }
}
