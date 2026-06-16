import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import TemplatesClient from "./templates-client"

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"

  let templates: any[] = []
  let workspacePlans: any[] = []
  let addonPlans: any[] = []

  try {
    const templatesRes = await fetch(`${baseUrl}/api/public/content/templates`, {
      headers: { "Authorization": `Bearer ${globalToken}` },
      cache: "no-store"
    })
    if (templatesRes.ok) {
      const json = await templatesRes.json()
      const rawTemplates = json.data || []
      templates = rawTemplates.map((t: any) => {
        const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data
        return { ...d, id: t.id }
      })
    }
  } catch (err) {
    console.error("Failed to fetch templates:", err)
  }

  try {
    const plansRes = await fetch(`${baseUrl}/api/public/plans?type=workspace`, {
      headers: { "Authorization": `Bearer ${globalToken}` },
      cache: "no-store"
    })
    if (plansRes.ok) {
      const json = await plansRes.json()
      if (json.plans) {
        workspacePlans = json.plans.map((p: any) => ({
          id: p.id,
          name: p.name,
          priceAmount: p.price,
          yearlyPrice: p.yearlyPrice,
          desc: p.description || "",
          features: p.features || []
        }))
      }
    }
  } catch (err) {
    console.error("Failed to fetch workspace plans:", err)
  }

  try {
    const addonsRes = await fetch(`${baseUrl}/api/public/content/sacms-addons`, {
      headers: { "Authorization": `Bearer ${globalToken}` },
      cache: "no-store"
    })
    if (addonsRes.ok) {
      const json = await addonsRes.json()
      if (json.data) {
        addonPlans = json.data.map((entry: any) => ({
          id: entry.data?.id || entry.id,
          name: entry.data?.name || "Add-on",
          priceAmount: entry.data?.price || 0
        }))
      }
    }
  } catch (err) {
    console.error("Failed to fetch addon plans:", err)
  }

  return (
    <TemplatesClient 
      initialTemplates={templates}
      initialWorkspacePlans={workspacePlans}
      initialAddonPlans={addonPlans}
    />
  )
}
