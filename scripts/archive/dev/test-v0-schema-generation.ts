import { generateSystemSchema } from "./src/lib/ai-schema-generator"

async function run() {
  try {
    const prompt = "Create a travel blog with articles, destination guides, and a contact form."
    console.log("Generating schema for prompt:", prompt)
    const schema = await generateSystemSchema(prompt, "test-tenant-id")
    console.log("Generated Schema:", JSON.stringify(schema, null, 2))
  } catch (error) {
    console.error("Error:", error)
  }
}

run()
