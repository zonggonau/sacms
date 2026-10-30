/**
 * POST /api/admin/proposals/suggest-features
 * AI-suggests a short list of concrete website page/menu names tailored to
 * an institution's name/type (e.g. a dental clinic → "Home, Layanan, Poli
 * Gigi, Dokter Kami, Kontak"), for staff to review/edit before it's saved
 * as the proposal's `featuresText` and rendered as its own "Halaman &
 * Fitur Website" section on the generated PDF — additive to, never
 * replacing, the fixed CMS/Frontend/Domain & SSL/Storage package item.
 * Unmetered against any tenant/user AI credit balance — same shape as the
 * existing /api/admin/ai/smart-fill precedent (no tenantId/userId in the
 * AIConfig), since this is a platform-staff action with no tenant of its
 * own. No silent mock fallback on failure — a real AI Gateway problem is
 * surfaced as a clear error instead (matching the project's AI Schema
 * Generator convention), not disguised as a success.
 */
import { NextResponse } from "next/server"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { z } from "zod"

const ALLOW_ROLES = ["employee"]

const SuggestSchema = z.object({
  institutionName: z.string().trim().min(1).max(255),
  institutionType: z.string().trim().max(100).optional(),
})

const SYSTEM_PROMPT = `Anda adalah information architect untuk SaCMS, perusahaan pembuat Content Management System.
Tugas Anda: menyarankan daftar NAMA HALAMAN/MENU website yang konkret untuk sebuah instansi/klien calon pelanggan, dalam Bahasa Indonesia — seolah Anda merancang menu navigasi website tersebut.
Setiap item adalah nama halaman atau bagian website yang singkat (1-3 kata) dan mudah dipahami pelanggan saat membaca penawaran, BUKAN manfaat/istilah teknis generik (hindari "Pendaftaran Online", "Sistem Terintegrasi"; gunakan nama halaman konkret seperti "Home", "Jadwal Dokter").
Sesuaikan dengan jenis instansi — contoh untuk klinik gigi: "Home", "Tentang Kami", "Layanan", "Poli Gigi", "Dokter Kami", "Jadwal Praktik", "Booking Online", "Kontak". Contoh untuk sekolah: "Home", "Profil Sekolah", "Program Studi", "Pendaftaran Siswa Baru", "Berita & Kegiatan", "Galeri", "Kontak".
Balas HANYA dengan JSON murni berbentuk: {"features": ["Halaman 1", "Halaman 2", ...]} — tepat 5 sampai 8 item, tanpa penjelasan tambahan, tanpa markdown.`

export const POST = withAdminAuth(
  async (request) => {
    const body = await request.json().catch(() => null)
    const parsed = SuggestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("validation", { message: "Nama instansi wajib diisi." })
    }
    const { institutionName, institutionType } = parsed.data

    const userPrompt = `Nama instansi: ${institutionName}\nJenis instansi: ${institutionType || "tidak disebutkan"}\n\nSarankan daftar nama halaman/menu website yang cocok untuk instansi ini.`

    try {
      const { safeGenerateContent } = await import("@/lib/ai")
      const result = await safeGenerateContent(SYSTEM_PROMPT, userPrompt, {
        responseFormat: "json_object",
        action: "admin_proposal_suggest_features",
        maxTokens: 500,
      })

      const parsedContent = JSON.parse(result.text)
      const features = Array.isArray(parsedContent?.features)
        ? parsedContent.features.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 10)
        : []

      if (features.length === 0) {
        return apiError("internal", { message: "AI tidak menghasilkan saran fitur yang valid. Coba lagi." })
      }

      return NextResponse.json({ features })
    } catch (err: any) {
      console.error("[Proposals] AI suggest-features error:", err)
      if (err?.status === 429) {
        return apiError("rate_limited", { message: "Kredit AI platform sedang habis. Coba lagi nanti." })
      }
      return apiError("internal", {
        message: "AI sedang tidak bisa digunakan (kemungkinan Vercel AI Gateway bermasalah). Coba lagi nanti.",
      })
    }
  },
  { allowRoles: ALLOW_ROLES },
)
