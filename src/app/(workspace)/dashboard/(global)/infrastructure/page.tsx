import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AccountInfrastructureView } from "./account-infrastructure-view"

export default async function AccountInfrastructurePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  return <AccountInfrastructureView />
}
