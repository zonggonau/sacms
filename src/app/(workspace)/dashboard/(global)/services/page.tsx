import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { ServicesView, VpsPlanItem } from "@/components/dashboard/services-view"
import { getVpsCatalogPlans } from "@/lib/vps-catalog"
import { Metadata } from "next"
import { getContaboInstances } from "@/lib/contabo"
import { getGlobalWorkspaceId } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Layanan Cloud VPS & Dedicated Server | SaCMS",
  description: "Katalog layanan server VPS & Dedicated PostgreSQL 17 dengan bantuan setup tim IT Support.",
}

export default async function ServicesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const isSuperAdmin = session.user.role === "super_admin"

  // 1. Ambil daftar layanan VPS yang BENAR-BENAR milik user ini (sesuai session.user.id)
  const userVpsList = (db as any).userVpsService?.findMany
    ? await db.userVpsService.findMany({
        where: isSuperAdmin ? {} : { userId: session.user.id },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : []

  // 2. Ambil daftar workspace milik pengguna untuk keperluan penautan server ke workspace
  const globalId = await getGlobalWorkspaceId()
  const SYSTEM_SLUGS = [globalId, "sacms-global", "sacms"]

  const userWorkspaces = await db.tenant.findMany({
    where: isSuperAdmin
      ? { slug: { notIn: SYSTEM_SLUGS }, id: { not: globalId } }
      : {
          slug: { notIn: SYSTEM_SLUGS },
          id: { not: globalId },
          members: { some: { userId: session.user.id } },
        },
    select: {
      id: true,
      name: true,
      slug: true,
      databaseUrl: true,
      createdAt: true,
      ownerId: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // 3. Ambil live compute instances dari Contabo API (HANYA UNTUK SUPER ADMIN KARENA MILIK SUPER ADMIN)
  let contaboInstances: any[] = []
  let contaboError: string | undefined = undefined

  if (isSuperAdmin) {
    const contaboRes = await getContaboInstances()
    if (contaboRes.success) {
      contaboInstances = contaboRes.data
    } else {
      contaboError = contaboRes.error
    }
  }

  // 4. Ambil katalog paket VPS — sumber bersama dengan endpoint yang dipakai
  // tab Infrastructure per-workspace (src/lib/vps-catalog.ts), supaya kedua
  // tempat selalu menampilkan paket & harga yang sama (Hanya untuk non-super admin)
  const catalogPlans: VpsPlanItem[] = isSuperAdmin ? [] : await getVpsCatalogPlans()

  return (
    <ServicesView
      workspaces={userWorkspaces as any}
      userVpsList={userVpsList as any}
      catalogPlans={catalogPlans}
      contaboInstances={contaboInstances}
      contaboError={contaboError}
      isSuperAdmin={isSuperAdmin}
      userName={session.user.name || undefined}
      userEmail={session.user.email || undefined}
    />
  )
}

