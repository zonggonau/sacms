import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from "dotenv"
dotenv.config()

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || ""
  console.log("Using API Key:", apiKey.slice(0, 10) + "...")
  
  const genAI = new GoogleGenerativeAI(apiKey)
  
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-1.0-pro"
  ]

  // Try manual list models via fetch
  console.log("\nAttempting to list all models via REST API...")
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const data = await res.json()
    if (data.models) {
      console.log("Available models:")
      data.models.forEach((m: any) => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`))
    } else {
      console.log("Could not list models:", JSON.stringify(data))
    }
  } catch (e: any) {
    console.error("Fetch failed:", e.message)
  }
}

main()
