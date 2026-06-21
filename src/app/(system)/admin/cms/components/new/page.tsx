import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminNewComponentClient from "./admin-new-component-client"

export default async function AdminNewComponentPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "super_admin") {
    redirect("/login")
  }

  return (
    <AdminNewComponentClient />
  )
}
