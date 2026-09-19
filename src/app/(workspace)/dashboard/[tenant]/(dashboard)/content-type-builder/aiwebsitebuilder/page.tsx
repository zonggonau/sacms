import { redirect } from "next/navigation"

export default async function LegacyAiWebsiteBuilderPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/aibuilder`)
}
