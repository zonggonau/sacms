import { NextResponse } from "next/server"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(async (request, _context, { access }) => {
    const body = await request.json()
    const { sourceLocale = "id", targetLocale = "en", data = {} } = body

    if (!data || Object.keys(data).length === 0) {
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

      const translatedData = JSON.parse(result.text)

      return NextResponse.json({
        success: true,
        translatedData,
        sourceLocale,
        targetLocale,
      })
    } catch (err: any) {
      // Vercel AI Gateway not configured (or a transient failure) — fall
      // back to a simulated translation instead of a hard error, same as
      // before this route spoke directly to a provider.
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
        notice: err.message?.includes("belum dikonfigurasi")
          ? "Vercel AI Gateway belum disetel, menggunakan simulasi translasi."
          : "Gagal menghubungi AI Gateway, menggunakan simulasi translasi.",
      })
    }
}, { minRole: "editor" })
