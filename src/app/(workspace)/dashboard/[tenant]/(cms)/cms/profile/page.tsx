import { UserProfile } from "@/components/dashboard/user-profile"
import { getProfileAction } from "@/actions/profile"
import { redirect } from "next/navigation"

export default async function CMSProfilePage() {
  const data = await getProfileAction()
  if (data.error) redirect("/login")
  
  return <UserProfile initialData={data.user ? { ...data.user, name: data.user.name || "" } : undefined} />
}
