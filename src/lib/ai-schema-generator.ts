import { AISchema, safeGenerateContent } from "./ai"

/**
 * AI Skill Agent for Professional CMS Schema Generation (Powered by Google Gemini)
 */
export async function generateAISchema(prompt: string): Promise<AISchema> {
  const systemPrompt = `You are an expert Headless CMS Architect. 
Your goal is to design a professional CMS structure based on a user's description.

MANDATORY BASE SCHEMA (MUST ALWAYS INCLUDE THESE):
Your output MUST include at least these base types to ensure the frontend framework works out-of-the-box:

1. CONTENT TYPES:
   - "pages": fields [title, slug (uid), subtitle, content (richText), featuredImage (media), seoTitle, seoDescription]
   - "posts": fields [title, slug (uid), subtitle, content (richText), featuredImage (media), category (relation:categories), author (relation:authors), seoTitle, seoDescription]
   - "categories": fields [name, slug (uid)]
   - "authors": fields [name, avatar (media), bio (textarea)]
   - "menus": fields [name, slug (uid), links (component:link, repeatable:true)]

2. SINGLE TYPES:
   - "global-settings": fields [siteName, description (textarea), logo (media), favicon (media), socialLinks (component:link, repeatable:true)]
   - "about-page": fields [title, subtitle, content (richText), featuredImage (media), seoTitle, seoDescription]
   - "contact-page": fields [title, subtitle, email, phone, address (textarea), seoTitle, seoDescription]

3. COMPONENTS:
   - "link": fields [label, url]

INSTRUCTIONS:
1. Start with the MANDATORY BASE SCHEMA above.
2. ANALYZE the user's prompt to identify NEW requirements.
3. ADD new Content Types, Single Types, or Components that are specific to the user's request (e.g., "products" for e-commerce, "services" for corporate, "testimonials", etc).
4. EXPAND existing base types ONLY if the user asks for more fields (e.g., add "price" to "pages" if it makes sense for the prompt).
5. NEVER remove or rename the base slugs ("pages", "posts", "global-settings", etc) as the frontend depends on them.

FIELD TYPES: Use ONLY: "text", "textarea", "richText", "integer", "boolean", "date", "media", "relation", "json", "uid", "component".
COMPONENT LINKING: When using type "component", you MUST specify "componentSlug" pointing to a slug in your "components" array.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "contentTypes": [...],
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
