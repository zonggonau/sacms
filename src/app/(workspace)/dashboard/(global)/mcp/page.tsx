import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getOwnerMcpTokenAction } from "@/actions/owner-mcp-token"
import { OwnerMcpClient } from "./owner-mcp-client"

export default async function OwnerMcpPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const result = await getOwnerMcpTokenAction()
  const token = ("token" in result ? result.token : null) ?? null

  return <OwnerMcpClient activeToken={token} />
}
