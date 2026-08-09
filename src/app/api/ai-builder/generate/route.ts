import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { safeGenerateContent } from "@/lib/ai"
import { AI_BUILDER_SCHEMA_PROMPT, AI_BUILDER_FRONTEND_PROMPT } from "@/lib/ai/prompts"
import { v0 } from "v0-sdk"

export const maxDuration = 300 // 5 minutes (for Vercel)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prompt } = await req.json()
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 })
  }

  const userId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        sendEvent({ step: 1, message: "Designing database schema..." })
        
        // 1. Generate Schema using DeepSeek
        const schemaPrompt = AI_BUILDER_SCHEMA_PROMPT.replace("{{PROMPT}}", prompt)
        const schemaRes = await safeGenerateContent(schemaPrompt, "Generate schema as JSON only", {
          responseFormat: "json_object",
          maxTokens: 4000,
          temperature: 0.2
        })
        
        let schemaData
        try {
          schemaData = JSON.parse(schemaRes.text)
        } catch (e) {
          throw new Error("AI returned invalid JSON schema.")
        }
        
        sendEvent({ step: 2, message: "Creating workspace..." })
        
        // 2. Create Workspace
        const tenantName = schemaData.name || "AI Generated Workspace"
        const tenantSlug = "ai-" + randomBytes(4).toString("hex")
        
        const newTenant = await db.$transaction(async (tx) => {
          const t = await tx.tenant.create({
            data: {
              name: tenantName,
              slug: tenantSlug,
              plan: "free",
              status: "active",
            }
          })

          await tx.tenantMember.create({
            data: {
              tenantId: t.id,
              userId: userId,
              role: "owner",
            }
          })

          await tx.subscription.create({
            data: {
              userId: userId,
              tenantId: t.id,
              plan: "free",
              status: "active",
              currentPeriodStart: new Date(),
            }
          })
          return t
        })

        sendEvent({ step: 3, message: "Provisioning schema..." })
        
        // 3. Provision Content Types
        const contentTypes = schemaData.contentTypes || []
        for (const ct of contentTypes) {
          const contentType = await db.contentType.create({
            data: {
              tenantId: newTenant.id,
              name: ct.name,
              slug: ct.slug,
              description: ct.description || "",
              isPublished: true,
              schemaFields: {
                create: (ct.fields || []).map((f: any, idx: number) => ({
                  name: f.name,
                  slug: f.slug,
                  type: f.type,
                  required: !!f.required,
                  order: idx,
                }))
              }
            }
          })
          
          await db.tenantContentTypeAssignment.create({
            data: {
              tenantId: newTenant.id,
              contentTypeId: contentType.id,
              enabled: true
            }
          })
        }
        
        // Provision Single Types
        const singleTypes = schemaData.singleTypes || []
        for (const st of singleTypes) {
          const singleType = await db.singleType.create({
            data: {
              tenantId: newTenant.id,
              name: st.name,
              slug: st.slug,
              description: st.description || "",
              isPublished: true,
              schemaFields: {
                create: (st.fields || []).map((f: any, idx: number) => ({
                  name: f.name,
                  slug: f.slug,
                  type: f.type,
                  required: !!f.required,
                  order: idx,
                }))
              }
            }
          })
          
          await db.tenantSingleTypeAssignment.create({
            data: {
              tenantId: newTenant.id,
              singleTypeId: singleType.id,
              locale: "en",
              enabled: true,
              data: "{}",
              publishedAt: new Date()
            }
          })
        }

        // 4. Generate API Token
        sendEvent({ step: 4, message: "Generating API token..." })
        const tokenString = "sacms_" + randomBytes(24).toString("hex")
        // Note: For simplicity we are creating a token without hashing, normally you hash it!
        // but for read-only public access in this demo we will just use the string.
        // Wait, SaCMS requires hashing. Let's look at how API tokens are verified.
        // Or we can just bypass auth for public endpoints if the token is passed, or create a valid hash.
        // The prompt says "generate API Token". SaCMS stores hashes.
        const crypto = require("crypto")
        const hashedToken = crypto.createHash("sha256").update(tokenString).digest("hex")
        
        await db.apiToken.create({
          data: {
            tenantId: newTenant.id,
            name: "AI Builder Public Token",
            token: hashedToken, // stored hash
            type: "read-only",
            lastFour: tokenString.slice(-4),
          }
        })
        
        sendEvent({ step: 5, message: "Writing frontend code..." })
        
        // 5. Generate Frontend Code using v0.dev API
        let frontendPrompt = AI_BUILDER_FRONTEND_PROMPT
          .replace("{{PROMPT}}", prompt)
          .replace("{{SCHEMA_JSON}}", JSON.stringify(schemaData))
          .replace("{{TENANT_SLUG}}", tenantSlug)
          .replace(/\{\{API_TOKEN\}\}/g, tokenString)
          
        try {
          const chat = await v0.chats.create({ 
            message: frontendPrompt
          })
          
          let code = ""
          if (chat.latestVersion?.files && chat.latestVersion.files.length > 0) {
            // Find App.tsx or use the first file
            const mainFile = chat.latestVersion.files.find(f => f.name === 'App.tsx') || chat.latestVersion.files[0]
            code = mainFile.content
          } else {
            code = "// No code generated by v0"
          }

          sendEvent({ 
            step: 6, 
            message: "Done!", 
            code: code,
            tenantSlug: tenantSlug
          })
        } catch (v0Error: any) {
          console.error("v0 API Error:", v0Error)
          sendEvent({ error: "v0 API Error: " + (v0Error.message || "Failed to generate code with v0") })
        }
        
        controller.close()
      } catch (error: any) {
        console.error("AI Builder Error:", error)
        sendEvent({ error: error.message || "An unexpected error occurred" })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
