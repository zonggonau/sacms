import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminNewContentTypeClient from "./admin-new-content-type-client"

export default async function AdminNewContentTypePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <AdminNewContentTypeClient />
  )
}
