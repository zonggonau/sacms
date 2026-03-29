import { AISchema, safeGenerateContent } from "./ai"

/**
 * AI Skill Agent for Professional CMS Schema Generation (Powered by Google Gemini)
 */
export async function generateAISchema(prompt: string): Promise<AISchema> {
  const systemPrompt = `You are an expert Headless CMS Architect. 
Your goal is to design a professional, industry-standard CMS structure (architecture) based on a user's website description.

ARCHITECTURAL RULES:
1. DESIGN CONTENT TYPES (Collection Types): 
   - Use standard naming (plural slugs like "blog-posts", "categories", "products").
   - Always include: "title" (text), "slug" (uid), "seoTitle" (text), "seoDescription" (textarea).
   - Use professional field types: "richText" for long content, "media" for images, "relation" for linking.
   - For main content, include: "isFeatured" (boolean), "publishedAt" (date).

2. DESIGN SINGLE TYPES: 
   - Used for global static content. 
   - Examples: "site-settings", "navbar-config", "footer-content", "home-page".
   - Include branding fields: "logo" (media), "brandName" (text), "primaryColor" (text).

3. DESIGN COMPONENTS: 
   - Professional CMS uses components for repeatable UI blocks.
   - Examples: "hero-section", "feature-card", "cta-button", "pricing-table".
   - Group them under categories like "Page Sections", "UI Elements".

4. FIELD TYPES: Use ONLY: "text", "textarea", "richText", "integer", "boolean", "date", "media", "relation", "json", "uid", "component".

5. RELATIONSHIPS: Specify "relationSlug" pointing to the slug of another content type.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "contentTypes": [
    {
      "name": "String",
      "slug": "String",
      "description": "String",
      "fields": [
        { "name": "String", "slug": "String", "type": "String", "required": Boolean, "relationSlug": "String (optional)" }
      ]
    }
  ],
  "singleTypes": [
    {
      "name": "String",
      "slug": "String",
      "description": "String",
      "fields": [...]
    }
  ],
  "components": [
    {
      "name": "String",
      "slug": "String",
      "category": "String",
      "fields": [...]
    }
  ]
}`

  try {
    const result = await safeGenerateContent(systemPrompt, `Website Description: ${prompt}\n\nGenerate a professional CMS structure for this website. Include relevant Components, Single Types, and Content Types.`, {
      responseMimeType: "application/json"
    })

    const parsed = JSON.parse(result.text)

    return {
      contentTypes: parsed.contentTypes || [],
      singleTypes: parsed.singleTypes || [],
      components: parsed.components || [],
    }
  } catch (error) {
    console.error("[AI Schema Generator] Error:", error)
    return { contentTypes: [], singleTypes: [], components: [] }
  }
}
