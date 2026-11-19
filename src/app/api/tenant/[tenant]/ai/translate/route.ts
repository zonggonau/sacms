import { NextResponse } from "next/server"
import { z } from "zod"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const localeSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,19}$/)
const translationSchema = z.object({
  sourceLocale: localeSchema.default("id"),
  targetLocale: localeSchema.default("en"),
  data: z.record(z.string(), z.unknown()),
})

export const POST = withStaffAuth(async (request, _context, { access }) => {
    const body = await readJson(request, translationSchema)
    if (!body.ok) return body.response

    const { sourceLocale, targetLocale, data } = body.data
    const fields = Object.keys(data)
    if (fields.length === 0) {
      return apiError("validation", { message: "Data konten kosong" })
    }

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

    try {
      const { safeGenerateContent } = await import("@/lib/ai")
      const result = await safeGenerateContent("", prompt, {
        responseFormat: "json_object",
        tenantId: access.tenantId,
        action: "translate",
      })

      const translatedData: unknown = JSON.parse(result.text)
      const parsed = z.record(z.string(), z.unknown()).safeParse(translatedData)
      if (!parsed.success || fields.some((field) => !Object.hasOwn(parsed.data, field) || typeof parsed.data[field] !== typeof data[field])) {
        return apiError("internal", { status: 502, message: "Format hasil terjemahan AI tidak sesuai dengan kolom yang diminta." })
      }

      return NextResponse.json({
        success: true,
        translatedData: Object.fromEntries(fields.map((field) => [field, parsed.data[field]])),
        sourceLocale,
        targetLocale,
      })
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 429) throw error
      return apiError("internal", { status: 502, message: "Layanan terjemahan AI gagal. Coba lagi." })
    }
}, { minRole: "editor" })
