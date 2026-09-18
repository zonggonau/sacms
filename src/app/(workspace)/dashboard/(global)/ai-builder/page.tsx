import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<{
    workspace?: string
    prompt?: string
  }>
}

export default async function GlobalAiBuilderRedirectPage({ searchParams }: PageProps) {
  const { workspace, prompt } = await searchParams
  const params = new URLSearchParams()
  if (workspace) params.set("workspace", workspace)
  if (prompt) params.set("prompt", prompt)

  const queryStr = params.toString() ? `?${params.toString()}` : ""
  redirect(`/aibuilder${queryStr}`)
}
