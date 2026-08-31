import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Atur Ulang Kata Sandi — SaCMS",
  description: "Masukkan kata sandi baru untuk mengamankan kembali akun SaCMS Anda.",
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
