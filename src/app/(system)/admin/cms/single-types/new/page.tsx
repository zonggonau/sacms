import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminNewSingleTypeClient from "./admin-new-single-type-client"

export default async function AdminNewSingleTypePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <AdminNewSingleTypeClient />
  )
}
