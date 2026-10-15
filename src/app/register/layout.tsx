import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Daftar Akun Baru — SaCMS",
  description: "Buat akun SaCMS gratis dan mulai kelola konten Anda dengan Headless CMS modern.",
  robots: { index: false, follow: true },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
