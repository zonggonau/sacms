"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RbacMatrixView } from "@/components/admin/rbac-matrix-view"

export default function AdminRbacRedirectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-xl border border-border/60">
                <Link href="/admin/users">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">RBAC & Peran Platform</h1>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                    IAM Unified
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Konfigurasi batas kapabilitas platform antara Super Admin dan Account Owner.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="rounded-xl text-xs font-bold h-8 border-border/80">
              <Link href="/admin/users">
                Lihat Pengguna Platform
              </Link>
            </Button>
          </div>

          <RbacMatrixView />
        </div>
      </div>
    </div>
  )
}
