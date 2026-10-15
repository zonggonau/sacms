import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Masuk ke Akun — SaCMS",
  description: "Masuk ke dashboard SaCMS untuk mengelola konten, API, dan infrastruktur multi-tenant Anda.",
  robots: { index: false, follow: true },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
