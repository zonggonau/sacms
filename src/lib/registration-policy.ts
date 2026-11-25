import { db } from "@/lib/database"
import { getPlatformSettings } from "@/lib/settings"

export type RegistrationMode = "open" | "invite_only" | "closed"

export const REGISTRATION_CLOSED_MESSAGE = "Pendaftaran akun baru sedang ditutup oleh admin platform."
export const REGISTRATION_INVITE_ONLY_MESSAGE =
  "Pendaftaran hanya melalui undangan. Minta admin workspace menambahkan email Anda sebagai anggota tim, lalu aktifkan akun lewat Lupa Kata Sandi di halaman masuk."

/**
 * The registrationMode (/admin/settings) that applies right now. A fresh
 * install with no super admin is always "open" so it can create its first one.
 */
export async function getEffectiveRegistrationMode(): Promise<RegistrationMode> {
  const { registrationMode } = await getPlatformSettings()
  if (registrationMode === "open") return "open"
  const hasSuperAdmin = await db.user.findFirst({ where: { role: "super_admin" }, select: { id: true } })
  return hasSuperAdmin ? registrationMode : "open"
}

/**
 * Why `email` may not create a new account, or null when it may. An "invite"
 * is the account a workspace admin creates through Tambah Anggota: a user row
 * that already belongs to at least one workspace.
 */
export async function registrationBlockReason(email: string): Promise<string | null> {
  const mode = await getEffectiveRegistrationMode()
  if (mode === "open") return null
  if (mode === "closed") return REGISTRATION_CLOSED_MESSAGE
  const invited = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, tenants: { some: {} } },
    select: { id: true },
  })
  return invited ? null : REGISTRATION_INVITE_ONLY_MESSAGE
}
