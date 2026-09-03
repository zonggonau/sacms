import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withStaffAuth, readJson } from "@/lib/api/route-helpers"

const smartFillSchema = z.object({
  prompt: z.string().min(1),
  contentType: z.string(),
  schema: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      options: z.any().optional(),
    })
  ),
  tone: z.string().optional().default("Professional"),
  language: z.string().optional().default("Indonesian"),
})

export const POST = withStaffAuth(async (request) => {
    const parsed = await readJson(request, smartFillSchema)
    if (!parsed.ok) return parsed.response

    const { prompt, contentType, schema, tone, language } = parsed.data
    const apiKey = process.env.OPENAI_API_KEY

    // 1. Try with OpenAI if configured
    if (apiKey) {
      try {
        const schemaDescription = schema
          .map(
            (f) =>
              `- "${f.slug}" (${f.name}, type: ${f.type}${f.required ? ", required" : ""})`
          )
          .join("\n")

        const systemPrompt = `You are an expert Headless CMS Content Creator.
You will receive a user draft prompt and a schema of fields for a content type named "${contentType}".
Generate a strictly valid JSON object where keys match the exact field slugs provided.
Follow the tone "${tone}" and output language "${language}".
Do NOT wrap the output in markdown codeblocks (no \`\`\`json). Output pure raw JSON only.

Field Types Guide:
- text / string: A clean single-line title or phrase.
- slug: URL-friendly lowercase kebab-case string (e.g. "panduan-lengkap-ai-2026").
- rich-text / markdown / textarea: Detailed, well-formatted paragraph or markdown content.
- tags: Array of short strings (e.g. ["ai", "teknologi", "cms"]).
- seo: JSON object with { "metaTitle": string (max 60 chars), "metaDescription": string (max 155 chars), "keywords": string[] }.
- number / percent / rating / currency: Numeric values appropriate to the context (e.g. rating 1-5, percent 0-100).
- boolean: boolean (true/false).
- date / datetime: ISO 8601 date string (e.g. "${new Date().toISOString().split("T")[0]}").
- location: JSON object with { "lat": number, "lng": number, "address": string }.
- icon: Lucide icon name (e.g. "Sparkles", "FileText", "Rocket", "Globe").
- code: JSON object with { "code": string, "language": string }.

Fields in Schema:
${schemaDescription}`

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `User Prompt: ${prompt}` },
            ],
            temperature: 0.7,
            max_tokens: 2500,
          }),
        })

        if (res.ok) {
          const aiData = await res.json()
          const rawContent = aiData.choices?.[0]?.message?.content?.trim() || "{}"
          const parsedContent = JSON.parse(rawContent)
          return NextResponse.json({ success: true, content: parsedContent })
        }
      } catch (openAiErr) {
        console.warn("OpenAI Smart Fill error, using intelligent fallback generator:", openAiErr)
      }
    }

    // 2. Intelligent Mock Generator (when OpenAI is unavailable or no key)
    const isIndonesian = language.toLowerCase().includes("indonesia") || language.toLowerCase() === "id"
    const slugified = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50) || "draf-konten-baru"

    const fallbackContent: Record<string, any> = {}

    for (const field of schema) {
      const slugLower = field.slug.toLowerCase()
      const typeLower = field.type.toLowerCase()

      if (typeLower === "slug") {
        fallbackContent[field.slug] = slugified
      } else if (slugLower.includes("title") || slugLower.includes("judul") || slugLower.includes("name") || slugLower.includes("nama")) {
        fallbackContent[field.slug] = prompt.length < 80 ? prompt : (isIndonesian ? "Panduan Lengkap: " + prompt.slice(0, 60) : "Comprehensive Guide: " + prompt.slice(0, 60))
      } else if (typeLower === "tags" || slugLower.includes("tag") || slugLower.includes("kategori")) {
        fallbackContent[field.slug] = isIndonesian ? ["inovasi", "teknologi", "panduan", "cms"] : ["innovation", "technology", "guide", "cms"]
      } else if (typeLower === "seo" || slugLower.includes("seo")) {
        fallbackContent[field.slug] = {
          metaTitle: `${prompt.slice(0, 50)} | SaCMS`,
          metaDescription: isIndonesian
            ? `Temukan informasi mendalam mengenai ${prompt.slice(0, 80)}. Disajikan secara terstruktur dan praktis.`
            : `Discover in-depth insights about ${prompt.slice(0, 80)}. Structured for developers and creators.`,
          keywords: ["sacms", "content", "headless-cms"],
        }
      } else if (typeLower === "rich-text" || typeLower === "markdown" || typeLower === "textarea") {
        if (isIndonesian) {
          fallbackContent[field.slug] = `## Pendahuluan\n\n${prompt}\n\n### 1. Latar Belakang & Urgensi\nDalam era transformasi digital modern, pengelolaan konten yang efisien dan terstruktur menjadi pilar utama keberhasilan setiap platform digital.\n\n### 2. Manfaat & Implementasi Praktis\n- **Efisiensi Tinggi:** Mempercepat proses publikasi konten ke berbagai saluran sekaligus.\n- **Konsistensi Data:** Memastikan integritas struktur data sesuai skema yang telah didefinisikan.\n- **Fleksibilitas API:** Memudahkan integrasi dengan REST, GraphQL, maupun SDK kustom.\n\n### Kesimpulan\nDengan menerapkan pendekatan modern, organisasi dapat meningkatkan produktivitas tim dan menyajikan pengalaman terbaik bagi pengguna akhir.`
        } else {
          fallbackContent[field.slug] = `## Overview\n\n${prompt}\n\n### 1. Key Insights & Principles\nIn today's fast-moving digital landscape, scalable and automated content management is essential for modern applications.\n\n### 2. Main Advantages\n- **Maximum Agility:** Accelerate time-to-market across web and mobile endpoints.\n- **Schema Integrity:** Guarantee reliable type-safe data schemas.\n- **Omnichannel Delivery:** Seamless integration via REST, GraphQL, and TypeScript SDKs.\n\n### Conclusion\nAdopting modern headless CMS architectures unlocks high productivity and superior user experiences.`
        }
      } else if (typeLower === "number" || typeLower === "percent" || typeLower === "rating") {
        if (typeLower === "rating") fallbackContent[field.slug] = 5
        else if (typeLower === "percent") fallbackContent[field.slug] = 95
        else fallbackContent[field.slug] = 100
      } else if (typeLower === "boolean") {
        fallbackContent[field.slug] = true
      } else if (typeLower === "date" || typeLower === "datetime") {
        fallbackContent[field.slug] = new Date().toISOString().split("T")[0]
      } else if (typeLower === "location") {
        fallbackContent[field.slug] = { lat: -6.2088, lng: 106.8456, address: "Jakarta, Indonesia" }
      } else if (typeLower === "icon") {
        fallbackContent[field.slug] = "Sparkles"
      } else if (typeLower === "code") {
        fallbackContent[field.slug] = {
          language: "typescript",
          code: `export async function fetchContent() {\n  const response = await fetch('/api/public/content/${contentType.toLowerCase()}');\n  return response.json();\n}`,
        }
      } else {
        fallbackContent[field.slug] = isIndonesian ? `Konten terisi otomatis untuk ${field.name}` : `Smart filled content for ${field.name}`
      }
    }

    return NextResponse.json({ success: true, content: fallbackContent })
})
