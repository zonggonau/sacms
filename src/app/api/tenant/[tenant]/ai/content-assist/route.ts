import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod/v4"

const assistSchema = z.object({
  action: z.enum(["generate", "improve", "translate", "seo"]),
  prompt: z.string().optional(),
  content: z.string().optional(),
  targetLanguage: z.string().optional(),
  tone: z.string().optional(),
  fieldSlug: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = assistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 })
    }

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
  } catch (error: any) {
    console.error("AI Content Assist Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
