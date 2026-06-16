"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"

export default function AdminTenantRedirectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  useEffect(() => {
    if (status === "authenticated") {
      // Redirect to tenant configuration page
      router.replace(`/dashboard/${tenantSlug}`)
    } else if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router, tenantSlug])

  return (
    <div className="flex items-center justify-center flex-1 flex-col w-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
