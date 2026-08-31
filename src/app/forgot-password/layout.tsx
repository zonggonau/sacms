import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lupa Kata Sandi — SaCMS",
  description: "Reset kata sandi akun SaCMS Anda melalui tautan verifikasi email.",
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
