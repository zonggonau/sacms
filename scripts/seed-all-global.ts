import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding ALL Global SaCMS Content...")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ No tenant found. Please register first.")
    return
  }

  const getCT = async (slug: string) => {
    const ct = await prisma.contentType.findFirst({ where: { slug } })
    if (!ct) {
      console.warn(`⚠️ Content Type ${slug} not found, skipping...`)
      return null
    }
    return ct
  }

  const clearAndSeed = async (slug: string, data: any[]) => {
    const ct = await getCT(slug)
    if (!ct) return

    await prisma.contentEntry.deleteMany({
      where: { contentTypeId: ct.id }
    })

    for (const item of data) {
      await prisma.contentEntry.create({
        data: {
          contentTypeId: ct.id,
          tenantId: tenant.id,
          status: "PUBLISHED",
          data: item
        }
      })
    }
    console.log(`  ✅ ${slug} seeded.`)
  }

  try {
    // 1. HERO
    await clearAndSeed("sacms-hero", [{
      badge_text: "Platform CMS Pertama di Papua",
      title: "Bangun Pengalaman Digital Tanpa Batas.",
      subtitle: "Headless CMS modern dengan arsitektur multi-tenant yang dirancang untuk kecepatan, keamanan, dan kemudahan skalabilitas bagi instansi dan startup.",
      cta_primary_text: "Mulai Gratis",
      cta_secondary_text: "Lihat Demo"
    }])

    // 2. FEATURES
    await clearAndSeed("sacms-features", [
      { title: "Multi-Tenant Native", description: "Isolasi data aman antar organisasi dalam satu infrastruktur terpusat.", icon: "Users", is_main: true, tag: "Architecture" },
      { title: "AI Content Generator", description: "Tulis konten berkualitas tinggi secara instan dengan bantuan AI terintegrasi.", icon: "Sparkles", is_main: true, tag: "Productivity" },
      { title: "API-First approach", description: "Kirim konten Anda ke platform mana pun (Web, Mobile, IoT) via REST atau GraphQL.", icon: "Code2", is_main: true, tag: "Developer" },
      { title: "Media Library", description: "Manajemen aset cloud dengan optimasi gambar otomatis menggunakan Cloudflare R2.", icon: "Image", is_main: false, tag: "Media" },
      { title: "Role-Based Access", description: "Kontrol akses pengguna secara granular untuk keamanan data yang maksimal.", icon: "Shield", is_main: false, tag: "Security" }
    ])

    // 3. PRICING
    await clearAndSeed("sacms-pricing", [
      { 
        name: "Starter", plan_slug: "starter", price: "499.000", description: "Sempurna untuk proyek kecil dan tim lokal.", 
        features_list: ["10 Content Schemas", "5.000 Content Entries", "5 Team Members", "100.000 API Calls"], 
        max_content_types: 10, max_content_entries: 5000, max_team_members: 5, max_api_calls: 100000, 
        max_storage: 1024, max_locales: 1, audit_log_retention: 0, support_level: "Email", is_popular: false, button_text: "Pilih Starter" 
      },
      { 
        name: "Business", plan_slug: "pro", price: "1.499.000", description: "Untuk instansi dengan kebutuhan konten yang intensif.", 
        features_list: ["50 Content Schemas", "50.000 Content Entries", "20 Team Members", "1.000.000 API Calls", "Audit Logs (7 Days)"], 
        max_content_types: 50, max_content_entries: 50000, max_team_members: 20, max_api_calls: 1000000, 
        max_storage: 10240, max_locales: 5, audit_log_retention: 7, support_level: "Priority", is_popular: true, button_text: "Pilih Business" 
      },
      { 
        name: "Enterprise", plan_slug: "enterprise", price: "Custom", description: "Performa maksimal untuk infrastruktur skala nasional.", 
        features_list: ["Unlimited Schemas", "Unlimited Entries", "Unlimited Members", "Custom SLA", "Audit Logs (Unlimited)"], 
        max_content_types: 999, max_content_entries: 999999, max_team_members: 999, max_api_calls: 99999999, 
        max_storage: 102400, max_locales: 99, audit_log_retention: 9999, support_level: "24/7 Dedicated", is_popular: false, button_text: "Hubungi Kami" 
      }
    ])

    // 4. ADDONS
    await clearAndSeed("sacms-addons", [
      { title: "AI Content Pack", addon_slug: "ai-pack", feature_key: "ai_generation", price_label: "+Rp 150k/bln", description: "Tingkatkan limit AI generation untuk produksi konten massal.", icon: "Sparkles" },
      { title: "Custom Domain", addon_slug: "custom-domain", feature_key: "white_label", price_label: "+Rp 50k/bln", description: "Gunakan domain kustom untuk admin panel dan API.", icon: "Globe" },
      { title: "Priority Support", addon_slug: "support-pro", feature_key: "priority_support", price_label: "+Rp 200k/bln", description: "Dukungan teknis prioritas melalui WhatsApp dan Zoom.", icon: "Headset" }
    ])

    // 5. WORKFLOW
    await clearAndSeed("sacms-workflow", [
      { step: "01", title: "Registrasi Workspace", description: "Daftar dan buat workspace khusus untuk organisasi Anda dalam hitungan detik.", icon: "UserPlus" },
      { step: "02", title: "Bangun Struktur Data", description: "Gunakan Content Builder untuk menentukan skema data (News, Blog, Products, dll).", icon: "Layout" },
      { step: "03", title: "Input & Kelola Konten", description: "Tulis konten Anda dengan Rich Text Editor yang modern dan intuitif.", icon: "FileEdit" },
      { step: "04", title: "Konsumsi via API", description: "Hubungkan konten ke website atau aplikasi mobile Anda melalui API yang cepat.", icon: "Zap" }
    ])

    // 6. FAQ
    await clearAndSeed("sacms-faq", [
      { question: "Apa itu Headless CMS?", answer: "Headless CMS adalah sistem manajemen konten back-end saja yang bertindak sebagai repositori konten, membuat konten dapat diakses melalui API untuk ditampilkan di perangkat apa pun." },
      { question: "Apakah SaCMS mendukung multi-bahasa?", answer: "Ya, SaCMS memiliki fitur i18n native yang memungkinkan Anda mengelola konten dalam berbagai bahasa seperti Indonesia, Inggris, dan bahasa daerah lainnya." }
    ])

    // 7. WHATSAPP
    await clearAndSeed("sacms-whatsapp", [{
      phone: "6282199220551",
      message: "Halo Tim SaCMS, saya tertarik untuk bertanya lebih lanjut mengenai layanan Headless CMS.",
      label: "Hubungi Kami",
      is_active: true
    }])

    // 8. ABOUT
    await clearAndSeed("sacms-about", [{
      title: "Misi Digitalisasi dari Timur Indonesia",
      content: "SaCMS lahir di Jayapura dengan satu misi: mempermudah akses teknologi bagi pengembang dan organisasi di Papua dan sekitarnya. Kami percaya bahwa setiap entitas berhak mendapatkan infrastruktur digital kelas dunia untuk menyampaikan cerita dan layanan mereka secara efisien.",
      image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80"
    }])

    // 9. OWNERS
    await clearAndSeed("sacms-owners", [
      { 
        name: "Zonggonau Cristoper", 
        role: "Founder & Lead Architect", 
        bio: "<p>Seorang pengembang perangkat lunak yang berdedikasi untuk membangun ekosistem teknologi di Papua. Berpengalaman dalam merancang sistem skala besar yang efisien dan aman.</p>",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
        social: { linkedin: "https://linkedin.com/in/cristoperz", github: "https://github.com/cristoperz" }
      },
      { 
        name: "Tim Engineering SaCode", 
        role: "Core Contributors", 
        bio: "<p>Kolektif pengembang berbakat dari komunitas SaCode yang berkomitmen pada inovasi teknologi dan standar kualitas kode internasional.</p>",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SaCode",
        social: { website: "https://sacode.web.id" }
      }
    ])

    console.log("✨ ALL Global SaCMS Content seeded successfully!")
  } catch (err: any) {
    console.error(`❌ Error seeding: ${err.message}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
