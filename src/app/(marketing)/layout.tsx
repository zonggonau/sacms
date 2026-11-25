import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { MarketingPageTransition } from "@/components/landing/marketing-page-transition"
import { getLandingData } from "@/lib/public-api"
import { getEffectiveRegistrationMode } from "@/lib/registration-policy"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [data, registrationMode] = await Promise.all([
    getLandingData(),
    getEffectiveRegistrationMode().catch(() => "open" as const),
  ])
  const wa = data.whatsapp || {
    phone: "6282199220551",
    message: "Halo! Saya tertarik dengan SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="flex flex-col min-h-screen bg-card text-foreground selection:bg-primary/30">
      <LandingHeader brandName={data.footer?.brand_name} registrationOpen={registrationMode === "open"} />
      <MarketingPageTransition>{children}</MarketingPageTransition>
      <FooterSection footer={data.footer} />
      <WhatsAppButton
        phone={wa.phone}
        message={wa.message}
        label={wa.label}
        isActive={wa.is_active}
      />
    </div>
  )
}
