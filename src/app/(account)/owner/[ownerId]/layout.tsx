import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Globe, LayoutDashboard, Sparkles, LogOut, User as UserIcon, Shield, Layers } from "lucide-react"

export default async function OwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ ownerId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const { ownerId } = await params

  // Verify owner access: Either superadmin or the user matching ownerSlug/id
  const ownerUser = await db.user.findFirst({
    where: {
      OR: [
        { ownerSlug: ownerId },
        { id: ownerId },
        { email: ownerId },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      ownerSlug: true,
      plan: true,
    },
  })

  if (!ownerUser) {
    redirect("/dashboard")
  }

  const isSuperAdmin = session.user.role === "super_admin"
  if (!isSuperAdmin && session.user.id !== ownerUser.id) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-sm text-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
              S
            </div>
            <span className="font-extrabold tracking-tight">SaCMS</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-mono font-bold text-foreground">
            <UserIcon className="h-3.5 w-3.5 text-primary" />
            <span>{ownerUser.ownerSlug || ownerUser.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-foreground">{ownerUser.name || ownerUser.email}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{ownerUser.role} • Plan {ownerUser.plan}</div>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard Pusat
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}
