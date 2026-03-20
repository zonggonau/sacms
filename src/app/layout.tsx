import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "@/components/providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ContentFlow - Headless CMS Platform",
  description: "Modern Headless CMS Platform. Build, manage, and deliver content anywhere with our powerful and flexible content management system.",
  keywords: ["Headless CMS", "Content Management", "API", "Next.js", "TypeScript", "SaaS"],
  authors: [{ name: "ContentFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ContentFlow - Headless CMS Platform",
    description: "Build, manage, and deliver content anywhere",
    siteName: "ContentFlow",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
