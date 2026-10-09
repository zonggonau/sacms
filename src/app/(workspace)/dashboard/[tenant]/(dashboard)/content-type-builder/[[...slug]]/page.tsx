import { redirect } from "next/navigation"

export default async function LegacyContentTypeBuilderRedirect({
  params,
}: {
  params: Promise<{ tenant: string; slug?: string[] }>
}) {
  const { tenant, slug = [] } = await params
  const fullPath = slug.join("/")

  if (fullPath.includes("single-types") || fullPath.includes("single-type")) {
    const sub = slug.filter(s => s !== "single-types" && s !== "single-type").join("/")
    redirect(`/dashboard/${tenant}/developer/single-types${sub ? `/${sub}` : ""}`)
  }

  if (fullPath.includes("components") || fullPath.includes("component")) {
    const sub = slug.filter(s => s !== "components" && s !== "component").join("/")
    redirect(`/dashboard/${tenant}/developer/components${sub ? `/${sub}` : ""}`)
  }

  if (fullPath.includes("content-types") || fullPath.includes("conten-type")) {
    const sub = slug.filter(s => s !== "content-types" && s !== "conten-type").join("/")
    redirect(`/dashboard/${tenant}/developer/content-types${sub ? `/${sub}` : ""}`)
  }

  // Default fallback
  redirect(`/dashboard/${tenant}/developer/content-types`)
}
