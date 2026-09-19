import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Daftar Akun Baru — SaCMS",
  description: "Buat akun SaCMS gratis dan mulai kelola konten Anda dengan Headless CMS modern berbasis Next.js 16.",
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
