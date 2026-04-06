import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding SaCMS Features and Workflow data...")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ No tenant found. Please register first.")
    return
  }

  const getCT = async (slug: string) => {
    const ct = await prisma.contentType.findFirst({ where: { slug } })
    if (!ct) throw new Error(`Content Type ${slug} not found`)
    return ct
  }

  try {
    // 1. SEED FEATURES (Kemampuan Platform)
    const ctFeatures = await getCT("sacms-features")
    
    // Clear existing
    await prisma.contentEntry.deleteMany({
      where: { contentTypeId: ctFeatures.id }
    })

    const features = [
      { title: "Multi-Tenant Native", description: "Satu-satunya CMS dengan dukungan multi-workspace bawaan. Isolasi data aman antar organisasi.", icon: "Users", is_main: true, tag: "Arsitektur" },
      { title: "AI Content Generator", description: "Bangun konten berkualitas dalam hitungan detik dengan bantuan kecerdasan buatan terintegrasi.", icon: "Sparkles", is_main: true, tag: "Produktivitas" },
      { title: "Native i18n", description: "Kelola konten multi-bahasa dengan mudah melalui antarmuka yang intuitif dan terintegrasi.", icon: "Languages", is_main: true, tag: "Global" },
      { title: "GraphQL & REST API", description: "Akses data Anda melalui API modern dengan filter canggih dan performa tinggi.", icon: "Code2", is_main: true, tag: "Developer" },
      { title: "Cloud Media Storage", description: "Penyimpanan media berbasis cloud dengan optimasi gambar otomatis dan CDN.", icon: "Cloud", is_main: true, tag: "Media" },
      { title: "Audit Trail", description: "Pantau setiap perubahan konten dengan log audit lengkap untuk keamanan dan kepatuhan.", icon: "Shield", is_main: true, tag: "Security" }
    ]

    for (const f of features) {
      await prisma.contentEntry.create({
        data: {
          contentTypeId: ctFeatures.id,
          tenantId: tenant.id,
          status: "PUBLISHED",
          data: f
        }
      })
    }
    console.log("  ✅ SaCMS Features seeded.")

    // 2. SEED WORKFLOW (Cara Kerja)
    const ctWorkflow = await getCT("sacms-workflow")
    
    // Clear existing
    await prisma.contentEntry.deleteMany({
      where: { contentTypeId: ctWorkflow.id }
    })

    const workflows = [
      { step: "01", title: "Registrasi & Setup", description: "Daftar dalam hitungan detik dan buat workspace pertama Anda secara instan.", icon: "UserPlus" },
      { step: "02", title: "Desain Konten", description: "Bangun skema konten yang fleksibel menggunakan builder drag-and-drop kami.", icon: "Layout" },
      { step: "03", title: "Publish & Deliver", description: "Terbitkan konten Anda dan konsumsi melalui API di platform manapun.", icon: "Zap" }
    ]

    for (const w of workflows) {
      await prisma.contentEntry.create({
        data: {
          contentTypeId: ctWorkflow.id,
          tenantId: tenant.id,
          status: "PUBLISHED",
          data: w
        }
      })
    }
    console.log("  ✅ SaCMS Workflow seeded.")

    // 3. SEED ABOUT
    const ctAbout = await getCT("sacms-about")
    await prisma.contentEntry.deleteMany({ where: { contentTypeId: ctAbout.id } })
    await prisma.contentEntry.create({
      data: {
        contentTypeId: ctAbout.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: {
          title: "Misi Kami untuk Digitalisasi Papua",
          content: "SaCMS lahir dari visi untuk memberdayakan potensi digital di Tanah Papua. Kami percaya bahwa infrastruktur teknologi yang tepat adalah kunci transformasi digital. Melalui SaCMS, kami menyediakan alat bagi instansi, bisnis, dan developer lokal untuk membangun pengalaman digital kelas dunia tanpa hambatan teknis yang rumit.",
          image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80"
        }
      }
    })
    console.log("  ✅ SaCMS About seeded.")

    // 4. SEED OWNERS
    const ctOwners = await getCT("sacms-owners")
    await prisma.contentEntry.deleteMany({ where: { contentTypeId: ctOwners.id } })
    const owners = [
      { 
        name: "Zonggonau Cristoper", 
        role: "Founder & Lead Architect", 
        bio: "<p>Seorang&nbsp;insinyur&nbsp;perangkat&nbsp;lunak&nbsp;yang&nbsp;berdedikasi&nbsp;untuk&nbsp;membangun&nbsp;ekosistem&nbsp;teknologi&nbsp;di&nbsp;Papua.&nbsp;Berpengalaman&nbsp;dalam&nbsp;arsitektur&nbsp;sistem&nbsp;skala&nbsp;besar.</p>",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
        social: { linkedin: "#", github: "#" }
      },
      { 
        name: "Tim Engineering SaCode", 
        role: "Core Contributors", 
        bio: "Kolektif pengembang berbakat dari komunitas SaCode yang berkomitmen pada inovasi dan kualitas kode tingkat tinggi.",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Team",
        social: { website: "https://sacode.web.id" }
      }
    ]
    for (const o of owners) {
      await prisma.contentEntry.create({
        data: {
          contentTypeId: ctOwners.id,
          tenantId: tenant.id,
          status: "PUBLISHED",
          data: o
        }
      })
    }
    console.log("  ✅ SaCMS Owners seeded.")

    console.log("✨ All landing page content seeded successfully!")
  } catch (err: any) {
    console.error(`❌ Error seeding: ${err.message}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
