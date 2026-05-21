"use client"

import { useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
export default function GenericEntryEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { status } = useSession()
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  useEffect(() => {
    async function fetchAndRedirect() {
      try {
        const res = await fetch(`/api/admin/entries/${id}`)
        if (res.ok) {
          const entry = await res.json()
          if (entry.contentType) {
            router.replace(`/admin/content-types/${entry.contentType.slug}/edit/${id}`)
          } else {
            // It might be a single type entry or something else
            // For now, redirect to dashboard or a generic error
            router.replace("/admin")
          }
        } else {
          router.replace("/admin")
        }
      } catch (error) {
        console.error("Error fetching entry for redirect:", error)
        router.replace("/admin")
      }
    }

    if (status === "authenticated") {
      fetchAndRedirect()
    } else if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [id, status, router])

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting to editor...</p>
        </div>
      </div>
    </div>
  )
}
