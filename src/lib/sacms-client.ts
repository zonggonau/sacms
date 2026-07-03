import fs from 'fs'
import path from 'path'

let API_KEY = process.env.FRONTEND_API_KEY
// Fallback to read from .env directly if the server was not restarted
if (!API_KEY) {
  try {
    const envPath = path.join(process.cwd(), '.env')
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/FRONTEND_API_KEY="?([^"\n\r]+)"?/)
    if (match) {
      API_KEY = match[1]
    }
  } catch (e) {
    // Ignore error
  }
}

// For server-side fetching during dev, we use NEXT_PUBLIC_APP_URL
// We replace 'localhost' with '127.0.0.1' to avoid Node.js IPv6 fetch errors.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001"
const BASE_URL = appUrl.replace('localhost', '127.0.0.1')
const GLOBAL_TENANT = "sacms-global"

const getHeaders = () => {
  if (!API_KEY) {
    console.warn("FRONTEND_API_KEY is not set in environment variables")
  }
  return {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  }
}

async function fetchFromSaCMS<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}/api/public/${GLOBAL_TENANT}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
    // Disable cache for testing
    cache: "no-store"
  })

  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    const text = await response.text()
    console.error(`Response body: ${text}`)
    console.error(`API KEY used: ${API_KEY ? "Present" : "Missing"}`)
    throw new Error(`Failed to fetch data from SaCMS: ${response.status}`)
  }

  const json = await response.json()
  return json as T
}

export async function getLandingPage() {
  return fetchFromSaCMS<any>("/single/sacms-landing-page")
}

export async function getAboutUs() {
  return fetchFromSaCMS<any>("/single/sacms-about")
}

export async function getWhatsappConfig() {
  return fetchFromSaCMS<any>("/single/sacms-whatsapp")
}

export async function getPricingPlans() {
  // Addons and Pricing should probably be sorted by a specific order if needed, but the API handles defaults
  return fetchFromSaCMS<any>("/content/sacms-pricing")
}

export async function getAddons() {
  return fetchFromSaCMS<any>("/content/sacms-addons")
}

export async function getTemplates() {
  return fetchFromSaCMS<any>("/content/templates")
}
