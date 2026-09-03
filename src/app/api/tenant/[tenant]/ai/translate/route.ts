import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(async (request) => {
    const body = await request.json()
    const { sourceLocale = "id", targetLocale = "en", data = {} } = body

    if (!data || Object.keys(data).length === 0) {
      return apiError("validation", { message: "Data konten kosong" })
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Return simulated translated content if API key is not configured
      const simulated: Record<string, any> = { ...data }
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string" && value.length > 0) {
          simulated[key] = `[${targetLocale.toUpperCase()}] ${value}`
        }
      }
      return NextResponse.json({
        success: true,
        simulated: true,
        translatedData: simulated,
        notice: "Gemini API Key belum disetel, menggunakan simulasi translasi.",
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `Anda adalah penerjemah profesional untuk Headless CMS SaCMS.
Tugas Anda adalah menerjemahkan data JSON konten berikut dari bahasa sumber "${sourceLocale}" ke bahasa target "${targetLocale}".

Aturan Ketat:
1. Pertahankan seluruh struktur JSON key asli persis seperti aslinya.
2. Terjemahkan HANYA nilai teks string (judul, ringkasan, deskripsi, rich-text HTML/Markdown).
3. JANGAN ubah slug UID, URL media/gambar, angka, boolean, UUID, format tanggal/waktu, atau nama field.
4. Jika ada tag HTML (seperti <p>, <strong>, <a>), pertahankan tag tersebut dan terjemahkan hanya isi teks di dalamnya.
5. Kembalikan HANYA JSON valid murni tanpa blok markdown atau teks tambahan lainnya.

Data JSON yang harus diterjemahkan:
${JSON.stringify(data, null, 2)}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Clean JSON markdown fences
    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let translatedData: any
    try {
      translatedData = JSON.parse(cleanJson)
    } catch {
      // Fallback
      translatedData = data
    }

    return NextResponse.json({
      success: true,
      translatedData,
      sourceLocale,
      targetLocale,
    })
})
