import { redirect } from "next/navigation"

// This standalone page was never linked from anywhere in the app — license
// activation is now a tab on the main Settings page, which reuses the same
// EnterpriseLicenseBanner component the account-level billing page uses.
// Redirecting instead of just deleting in case anything external (docs,
// bookmarks) still points here.
export default async function LegacyLicensePageRedirect({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/settings?tab=license`)
}
