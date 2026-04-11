import { AISchema, safeGenerateContent } from "./ai"

/**
 * AI Skill Agent for Professional CMS Schema Generation (Powered by Google Gemini)
 */
export async function generateAISchema(prompt: string): Promise<AISchema> {
  const systemPrompt = `You are a Senior Headless CMS Architect and System Designer.
Your mission is to design a high-end, enterprise-ready CMS structure based on the user's requirements.
The architecture must be modular, scalable, and follow industry best practices for content modeling.

### ARCHITECTURAL STANDARDS:
1. **CONTENT TYPES (Collection Types)**: Used for repeatable data like Articles, Products, or Team Members.
2. **SINGLE TYPES (Static Pages/Settings)**: Used for unique structures like the Homepage, Global Settings, or Footer configuration.
3. **COMPONENTS (Modular Blocks)**: Reusable field groups. Used for Page Builders (Hero, FAQ, Features) or metadata (SEO, Social Links).

### MANDATORY ECOSYSTEM (ALWAYS INCLUDE):
Your output MUST include these core structures to ensure the platform functions immediately:

#### 1. CORE CONTENT TYPES:
   - "pages": Page builder structure with [title, slug (uid), metadata (component:seo-metadata), content_blocks (component:any, repeatable:true)]
   - "posts": News/Blog articles with [title, slug (uid), summary (textarea), content (richText), featuredImage (media), category (relation:categories), tags (relation:tags), author (relation:authors), publishedAt (date), metadata (component:seo-metadata)]
   - "categories": [name, slug (uid), description (textarea)]
   - "authors": [name, slug (uid), avatar (media), bio (richText), social_links (component:social-link, repeatable:true)]
   - "tags": [name, slug (uid)]

#### 2. CORE SINGLE TYPES:
   - "site-config": Global branding [siteName, tagline, logo_light (media), logo_dark (media), favicon (media), contact_email, phone]
   - "navigation": [header_menu (component:nav-link, repeatable:true), footer_menu (component:nav-link, repeatable:true), social_links (component:social-link, repeatable:true)]
   - "homepage": [hero (component:hero-banner), featured_sections (component:any, repeatable:true), metadata (component:seo-metadata)]

#### 3. PROFESSIONAL COMPONENTS:
   - "seo-metadata": [metaTitle, metaDescription (textarea), ogImage (media), allowIndexing (boolean)]
   - "nav-link": [label, url, isExternal (boolean), children (component:nav-link, repeatable:true)]
   - "social-link": [platform (text), url, icon (text)]
   - "hero-banner": [title, subtitle (textarea), backgroundImage (media), primaryButtonLabel, primaryButtonUrl]
   - "rich-content": [body (richText)]

### INDUSTRY-SPECIFIC EXPANSION:
- If the prompt mentions "News" or "Portal": Add "Breaking News" (Single Type), "Advertisements" (Content Type), "Newsletter" (Single Type).
- If the prompt mentions "E-commerce": Add "Products", "Collections", "Reviews", "Discounts".
- If the prompt mentions "Corporate": Add "Services", "Testimonials", "Partners", "Case Studies".

### STRICT TECHNICAL RULES:
1. **FIELD TYPES**: Use ONLY: "text", "textarea", "richText", "integer", "decimal", "boolean", "date", "media", "relation", "json", "uid", "component".
2. **COMPONENT LINKING**: When using type "component", you MUST specify "componentSlug" matching a slug in your "components" array.
3. **NAMING**: Use clear, descriptive names. Slugs must be lowercase-kebab-case.
4. **SLUGS**: Never rename the mandatory slugs ("pages", "posts", "site-config", etc).

### OUTPUT REQUIREMENT:
Return ONLY a valid JSON object. No markdown, no commentary.
{
  "contentTypes": [
    { "name": "...", "slug": "...", "description": "...", "fields": [{ "name": "...", "slug": "...", "type": "...", "required": true, "componentSlug": "...", "repeatable": true }] }
  ],
  "singleTypes": [... same structure as contentTypes ...],
  "components": [... same structure as contentTypes ...]
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
