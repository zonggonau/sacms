import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import TemplatesClient from "./templates-client"

import { db } from "@/lib/database"

export const dynamic = "force-dynamic"

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

  const enterprise = false

  try {
    const templatesContentType = await db.contentType.findFirst({
      where: { slug: "templates", tenantId: null }
    })
    
    if (templatesContentType) {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: templatesContentType.id, tenantId: null, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" }
      })
      
      templates = entries.map(e => {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return { ...e, ...d, id: e.id }
      })
    }
  } catch (err) {
    console.error("Failed to query templates directly:", err)
  }

  try {
    const plansContentType = await db.contentType.findFirst({
      where: { slug: "sacms-workspace-pricing", tenantId: null }
    })
    
    // Add free plan base
    workspacePlans.push({
      id: "free",
      name: "Free Forever",
      description: "Basic workspace for personal projects.",
      priceAmount: 0,
      yearlyPrice: 0,
      desc: "Basic workspace for personal projects.",
      features: ["3 Content Schemas", "500 Content Entries", "1 Team Member", "1.000 API Calls/mo"],
    })

    if (plansContentType) {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: plansContentType.id, tenantId: null, status: "PUBLISHED" },
        orderBy: { createdAt: "asc" }
      })
      
      const dynamicPlans = entries.map(entry => {
        const d = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data as any
        
        let price = 0
        if (typeof d.price === 'string') price = parseInt(d.price.replace(/[^\d]/g, ''), 10) || 0
        else price = Number(d.price) || 0

        const features = Array.isArray(d.features) ? d.features : (typeof d.features === 'string' ? d.features.split(',').map((s: string) => s.trim()) : [])
        
        return {
          id: d.plan_slug || entry.id,
          name: d.name || "Unnamed Plan",
          priceAmount: price,
          yearlyPrice: price * 12,
          desc: d.description || "",
          features: features
        }
      })
      
      const dynamicIds = new Set(dynamicPlans.map(p => p.id))
      workspacePlans = [...workspacePlans.filter(p => !dynamicIds.has(p.id)), ...dynamicPlans]
    }
  } catch (err) {
    console.error("Failed to query workspace plans:", err)
  }

  try {
    const addonsContentType = await db.contentType.findFirst({
      where: { slug: "sacms-addons", tenantId: null }
    })
    
    if (addonsContentType) {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: addonsContentType.id, tenantId: null, status: "PUBLISHED" }
      })
      
      addonPlans = entries.map(entry => {
        const d = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data as any
        return {
          id: d.id || entry.id,
          name: d.name || "Add-on",
          priceAmount: d.price || 0
        }
      })
    }
  } catch (err) {
    console.error("Failed to query addon plans:", err)
  }

  return (
    <TemplatesClient 
      initialTemplates={templates}
      initialWorkspacePlans={workspacePlans}
      initialAddonPlans={addonPlans}
    />
  )
}
