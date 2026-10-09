import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { isUnchangedSecretValue } from "@/lib/settings-secrets"
import { getResolvedAiConfig } from "@/lib/settings"

export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json()
    const { apiKey, baseUrl } = body

    let resolvedKey = typeof apiKey === "string" ? apiKey.trim() : ""
    if (!resolvedKey || isUnchangedSecretValue(resolvedKey)) {
      const config = await getResolvedAiConfig()
      resolvedKey = config.aiGatewayApiKey?.trim() || ""
    }

    if (!resolvedKey) {
      return NextResponse.json({ success: false, message: "API Key tidak boleh kosong." }, { status: 400 })
    }

    // Normalisasi base URL: AI SDK menggunakan /v4/ai untuk inferensi,
    // sedangkan endpoint katalog model Vercel AI Gateway berada di /v1/models.
    let endpoint = (baseUrl || "https://ai-gateway.vercel.sh").trim().replace(/\/$/, "")
    if (endpoint.endsWith("/v4/ai")) {
      endpoint = `${endpoint.slice(0, -"/v4/ai".length)}/v1/models`
    } else if (endpoint.endsWith("/v1")) {
      endpoint = `${endpoint}/models`
    } else if (endpoint.endsWith("/models")) {
      // sudah mengarah ke endpoint models
    } else {
      endpoint = `${endpoint}/v1/models`
    }

    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
        "ai-gateway-protocol-version": "0.0.1",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const data = await res.json().catch(() => null)
      const count = Array.isArray(data) ? data.length : Array.isArray(data?.data) ? data.data.length : null
      const countMsg = count ? ` (${count} model terdeteksi)` : ""
      return NextResponse.json({
        success: true,
        message: `Koneksi Vercel AI Gateway berhasil diverifikasi!${countMsg} Seluruh model AI siap digunakan.`
      })
    }

    const err = await res.json().catch(() => ({}))
    const statusText = res.status === 401
      ? "API Key ditolak (401 Unauthorized). Pastikan API Key Vercel AI Gateway valid dan masih aktif di Vercel Dashboard."
      : (err.error?.message || res.statusText || "Gagal memverifikasi API Key.")

    return NextResponse.json({
      success: false,
      message: `Gateway error: ${statusText}`
    }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menghubungi Vercel AI Gateway." }, { status: 500 })
  }
})
