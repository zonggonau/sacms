"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function WhiteLabelRedirectPage() {
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  useEffect(() => {
    if (tenantSlug) {
      router.replace(`/dashboard/${tenantSlug}/settings?tab=white-label`)
    }
  }, [router, tenantSlug])

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}
