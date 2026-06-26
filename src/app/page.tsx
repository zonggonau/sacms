import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { getLandingData } from "@/lib/public-api"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SaCMS — Platform Digital Papua | Website Pemerintah, UMKM & Pariwisata",
  description: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung transformasi digital di Tanah Papua.",
}

export default async function HomePage() {
  const data = await getLandingData()
  const wa = data.whatsapp || {
    phone: "6281234567890",
    message: "Halo! Saya tertarik dengan SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="flex flex-col min-h-screen">
      <LandingHeader brandName={data.footer?.brand_name} />
      <main className="flex-1">
        <ModernLanding data={data} />
      </main>
      <WhatsAppButton
        phone={wa.phone}
        message={wa.message}
        label={wa.label}
        isActive={wa.is_active}
      />
    </div>
  )
}
