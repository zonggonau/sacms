import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "@/components/providers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "SaCMS — Smart Content Management System | Build smarter. Manage easier. Scale faster.",
  description: "SaCMS (Smart Content Management System) — Build smarter. Manage easier. Scale faster. Modern AI-native multi-tenant headless CMS with Dedicated PostgreSQL Appliance, AI website generation, and custom domain management.",
  keywords: ["SaCMS", "Smart Content Management System", "Headless CMS", "Content Management System", "Next.js", "TypeScript", "Multi-tenant CMS", "SaaS"],
  authors: [{ name: "SaCMS Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SaCMS — Smart Content Management System",
    description: "Build smarter. Manage easier. Scale faster.",
    siteName: "SaCMS — Smart Content Management System",
    type: "website",
  },
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <Providers session={session}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
