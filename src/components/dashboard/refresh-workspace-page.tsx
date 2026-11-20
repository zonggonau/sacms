"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RefreshWorkspacePage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending}
      onClick={() => startTransition(() => router.refresh())}>
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Memuat…" : "Muat ulang"}
    </Button>
  )
}
