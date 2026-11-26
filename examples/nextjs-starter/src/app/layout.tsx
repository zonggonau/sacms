import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Situs SaCMS", template: "%s · Situs SaCMS" },
  description: "Starter Next.js untuk konten SaCMS.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-semibold">Situs SaCMS</Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Beranda</Link>
              <Link href="/articles" className="hover:text-foreground">Artikel</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted-foreground">
            Konten dari SaCMS. Lihat README untuk mengganti nama koleksi dan field.
          </div>
        </footer>
      </body>
    </html>
  )
}
