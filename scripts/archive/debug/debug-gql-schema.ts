import { PrismaClient } from "@prisma/client"
import { buildDynamicTypeDefs } from "../src/lib/graphql-schema"

const db = new PrismaClient()

async function debug() {
  const tenantId = "cmnrkkp07007xujzgc5amc4vu"
  console.log(`Generating schema for tenant: ${tenantId}`)
  
  try {
    const typeDefs = await buildDynamicTypeDefs(tenantId, true, db)
    const lines = typeDefs.split("\n")
    
    console.log("--- SCHEMA START ---")
    lines.forEach((line, i) => {
      console.log(`${(i + 1).toString().padStart(4)}: ${line}`)
    })
    console.log("--- SCHEMA END ---")
    
  } catch (error) {
    console.error("Error building typeDefs:", error)
  } finally {
    await db.$disconnect()
  }
}

debug()
