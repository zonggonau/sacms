import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Public Swagger API Documentation — SaCMS",
  description: "Dokumentasi interaktif OpenAPI / Swagger UI untuk SaCMS Public REST API.",
}

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
