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

2. DESIGN SINGLE TYPES & COMPONENTS: 
   - Always include global types: "site-identity" (fields: brandName, logo, favicon), "navbar" (fields: links, logo, cta), "footer" (fields: copyright, socialLinks).
   - For complex pages like "home-page", use a MODULAR approach:
     a. Analyze the sections needed (e.g., Hero, Features, CTA).
     b. Create a COMPONENT for each section.
     c. In the Single Type, add a field with type "component" pointing to that component's slug.
   - Professional CMS uses components for repeatable UI blocks. Group them under categories like "Page Sections", "UI Elements".

3. FIELD TYPES: Use ONLY: "text", "textarea", "richText", "integer", "boolean", "date", "media", "relation", "json", "uid", "component".

4. COMPONENT LINKING: When using type "component", you MUST specify "componentSlug" pointing to a slug in your "components" array.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "contentTypes": [
    {
      "name": "String",
      "slug": "String",
      "description": "String",
      "fields": [
        { 
          "name": "String", 
          "slug": "String", 
          "type": "String", 
          "label": "String",
          "category": "String (e.g. Basic, Selection, Media, Relations, Advanced)",
          "description": "String",
          "required": Boolean, 
          "order": Number,
          "relationSlug": "String (optional)", 
          "componentSlug": "String (optional)" 
        }
      ]
    }
  ],
  "singleTypes": [...],
  "components": [...]
}`

  try {
    const result = await safeGenerateContent(systemPrompt, `Website Description: ${prompt}\n\nGenerate a professional CMS structure for this website. Include relevant Components, Single Types, and Content Types. (If the description is in Indonesian, generate names and descriptions in Indonesian but keep slugs in English).`, {
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
    throw error // Rethrow to allow fallback or error reporting in provisioning
  }
}

/**
 * AI Content Writer for generating entries based on Content Type fields
 */
export async function generateAIEntries(prompt: string, contentType: any): Promise<any[]> {
  const fieldsInfo = contentType.fields.map((f: any) => `- ${f.name} (slug: ${f.slug}, type: ${f.type})${f.required ? ' [REQUIRED]' : ''}`).join('\n')
  
  const systemPrompt = `You are an expert Content Writer for a headless CMS. 
Your goal is to generate professional, realistic data entries for a specific Content Type.

Content Type: ${contentType.name}
Fields:
${fieldsInfo}

RULES:
1. Generate between 1 to 5 high-quality entries based on the user's prompt.
2. Ensure data types match: 
   - media: Provide realistic image URLs from Unsplash (e.g., https://images.unsplash.com/photo-...)
   - richText: Provide formatted HTML strings.
   - date/datetime: ISO strings.
   - json: Valid JSON objects.
   - boolean: true or false.
3. Slugs should be URL-friendly (e.g., "my-title").
4. If the prompt is in Indonesian, write content in Indonesian but maintain field slugs.

OUTPUT FORMAT: Return ONLY a valid JSON array of objects, where each object keys are the field slugs.`

  try {
    const result = await safeGenerateContent(systemPrompt, `Request: ${prompt}\n\nGenerate realistic entries for the ${contentType.name} content type.`, {
      responseMimeType: "application/json"
    })

    const parsed = JSON.parse(result.text)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    console.error("[AI Entry Generator] Error:", error)
    throw error
  }
}
