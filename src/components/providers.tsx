"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

/**
 * BrandingProvider applies tenant-specific branding (colors, names) 
 * dynamically based on the current tenant in the URL.
 */
function BrandingProvider({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const [brandColor, setBrandColor] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantSlug) return

    async function fetchBranding() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/white-label`)
        if (res.ok) {
          const data = await res.json()
          if (data.primaryColor) {
            setBrandColor(data.primaryColor)
            // Apply primary color to CSS variable
            document.documentElement.style.setProperty('--primary', data.primaryColor)
            // Also apply a slightly transparent version for hover states if needed
            document.documentElement.style.setProperty('--primary-foreground', '#ffffff')
          }
          if (data.brandName) {
            document.title = `${data.brandName} - SaCMS`
          }
        }
      } catch (error) {
        console.error("Failed to load branding:", error)
      }
    }

    fetchBranding()
  }, [tenantSlug])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <BrandingProvider>
        {children}
      </BrandingProvider>
    </NextAuthSessionProvider>
  )
}
