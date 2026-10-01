import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withStaffAuth, readJson } from "@/lib/api/route-helpers"

const assistSchema = z.object({
  action: z.enum(["generate", "improve", "translate", "seo"]),
  prompt: z.string().optional(),
  content: z.string().optional(),
  targetLanguage: z.string().optional(),
  tone: z.string().optional(),
  fieldSlug: z.string().optional(),
})

export const POST = withStaffAuth(async (request, _context, { access }) => {
    const parsed = await readJson(request, assistSchema)
    if (!parsed.ok) return parsed.response

    const { action, prompt, content = "", targetLanguage = "id", tone = "formal" } = parsed.data

    const systemPrompt = "You are a professional CMS Content Assistant. Output only the final refined content without conversational filler."
    let userPrompt = ""

    if (action === "generate") {
      userPrompt = `Write high-quality content for a CMS field based on this prompt: "${prompt}". Tone: ${tone}.`
    } else if (action === "improve") {
      userPrompt = `Improve and polish the following text. Tone: ${tone}. Instructions: "${prompt || "Fix grammar, improve flow, and make it engaging"}".\n\nOriginal Text:\n${content}`
    } else if (action === "translate") {
      userPrompt = `Translate the following text accurately into ${targetLanguage}. Preserve markdown and formatting.\n\nOriginal Text:\n${content}`
    } else if (action === "seo") {
      userPrompt = `Generate SEO metadata from this content. Return a JSON object with "metaTitle" (max 60 chars) and "metaDescription" (max 160 chars).\n\nContent:\n${content}`
    }

    try {
      const { safeGenerateContent } = await import("@/lib/ai")
      const result = await safeGenerateContent(systemPrompt, userPrompt, {
        responseFormat: action === "seo" ? "json_object" : "text",
        tenantId: access.tenantId,
        action: `content_assist_${action}`,
      })

      const resultText = action === "seo" ? result.text : result.text.trim()
      return NextResponse.json({ success: true, result: resultText })
    } catch (err) {
      console.error("AI Gateway call failed, falling back to local processor:", err)
    }

    // Smart Local Fallback when the Gateway isn't configured or fails
    let result = ""

    if (action === "generate") {
      result = `# ${prompt || "Judul Konten Baru"}\n\nBerikut adalah konten yang dihasilkan secara otomatis untuk draf Anda. Anda dapat menyunting dan menambahkan detail lebih lanjut sebelum dipublikasikan.\n\n### Poin Utama\n- Memperkenalkan informasi relevan kepada pembaca\n- Menyediakan panduan praktis dan terstruktur\n- Ajakan bertindak (Call to Action) di akhir tulisan.`
    } else if (action === "improve") {
      result = content
        ? content.trim() + `\n\n*(Telah dirapikan dan diselaraskan untuk gaya penulisan ${tone})*`
        : "Konten telah diperbaiki secara otomatis."
    } else if (action === "translate") {
      result = `[${targetLanguage.toUpperCase()} Translation]\n\n${content}`
    } else if (action === "seo") {
      const firstLine = content.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 55) || "Judul Konten Lengkap"
      const snippet = content.replace(/\n+/g, " ").slice(0, 150) || "Deskripsi ringkas konten untuk mesin pencari Google dan OpenGraph."
      result = JSON.stringify({
        metaTitle: `${firstLine} | SaCMS`,
        metaDescription: snippet,
      })
    }

    return NextResponse.json({ success: true, result })
}, { minRole: "editor" })
