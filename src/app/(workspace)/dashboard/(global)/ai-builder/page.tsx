import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<{
    workspace?: string
    prompt?: string
  }>
}

export default async function GlobalAiBuilderRedirectPage({ searchParams }: PageProps) {
  const { workspace, prompt } = await searchParams

  if (workspace) {
    const params = new URLSearchParams()
    if (prompt) params.set("prompt", prompt)
    const queryStr = params.toString() ? `?${params.toString()}` : ""
    redirect(`/dashboard/${workspace}/content-type-builder/aiwebsitebuilder${queryStr}`)
  }

  redirect("/dashboard")
}
