import { db } from "@/lib/database"
import { getPlatformSettings } from "@/lib/settings"

export const REGISTRATION_CLOSED_MESSAGE = "Pendaftaran akun baru sedang ditutup oleh admin platform."
export const REGISTRATION_INVITE_ONLY_MESSAGE =
  "Pendaftaran hanya melalui undangan. Minta admin workspace menambahkan email Anda sebagai anggota tim, lalu aktifkan akun dari email undangan."

/**
 * Why `email` may not create a new account under the platform's
 * registrationMode (/admin/settings), or null when it may. An "invite" is the
 * account a workspace admin creates through Tambah Anggota: a user row that
 * already belongs to at least one workspace.
 */
export async function registrationBlockReason(email: string): Promise<string | null> {
  const { registrationMode } = await getPlatformSettings()
  if (registrationMode === "open") return null
  // A fresh install still needs to create its first super admin.
  const hasSuperAdmin = await db.user.findFirst({ where: { role: "super_admin" }, select: { id: true } })
  if (!hasSuperAdmin) return null
  if (registrationMode === "closed") return REGISTRATION_CLOSED_MESSAGE
  const invited = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, tenants: { some: {} } },
    select: { id: true },
  })
  return invited ? null : REGISTRATION_INVITE_ONLY_MESSAGE
}
