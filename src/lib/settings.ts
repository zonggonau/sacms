import { db } from "@/lib/database"

export async function getGlobalWorkspaceId(): Promise<string> {
  try {
    const setting = await db.setting.findUnique({
      where: { key: "globalTenantId" }
    })
    
    // Fallback to "sacms-global" if not explicitly set in the database
    return setting?.value || "sacms-global"
  } catch (error) {
    console.error("Error fetching globalTenantId from settings:", error)
    return "sacms-global"
  }
}
