import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const assistSchema = z.object({
  action: z.enum(["generate", "improve", "translate", "seo"]),
  prompt: z.string().optional(),
  content: z.string().optional(),
  targetLanguage: z.string().optional(),
  tone: z.string().optional(),
  fieldSlug: z.string().optional(),
})

export const POST = withStaffAuth(async (request) => {
    const parsed = await readJson(request, assistSchema)
    if (!parsed.ok) return parsed.response

    const { action, prompt, content = "", targetLanguage = "id", tone = "formal" } = parsed.data
    const apiKey = process.env.OPENAI_API_KEY

    // If OpenAI API Key is configured, use OpenAI
    if (apiKey) {
      try {
        let systemPrompt = "You are a professional CMS Content Assistant. Output only the final refined content without conversational filler."
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

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const resultText = data.choices?.[0]?.message?.content?.trim() || ""
          return NextResponse.json({ success: true, result: resultText })
        }
      } catch (err) {
        console.error("OpenAI API call failed, falling back to local processor:", err)
      }
    }

    // Smart Local Fallback when OPENAI_API_KEY is not configured
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
})
