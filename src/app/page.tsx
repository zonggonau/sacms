import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Database, 
  Code2, 
  Users, 
  Zap, 
  Shield, 
  Globe, 
  Layers,
  ArrowRight,
  Check,
  GitBranch,
  Languages,
  Search,
  Webhook,
  Cloud,
  Terminal,
  FileCode2,
  X,
  Sparkles,
  Cpu,
  Layout,
  Monitor,
  Smartphone,
  Server,
  HelpCircle,
  Lock,
  Image as ImageIcon,
  ChevronRight,
  HardDrive,
  RefreshCw,
  BrainCircuit,
} from "lucide-react"
import Link from "next/link"
import { LandingHeader } from "@/components/landing/header"
import { db } from "@/lib/database"

import { WhatsAppButton } from "@/components/landing/whatsapp-button"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "NokenStack - Headless CMS Modern Karya Anak Papua",
  description: "Infrastruktur digital berperforma tinggi dengan AI Generator dan native multi-tenancy untuk transformasi digital instansi Anda.",
}

// Icon mapping helper
const iconMap: Record<string, any> = {
  Sparkles, Cpu, Layout, Code2, Zap, Monitor, Smartphone, Server, HelpCircle, 
  HardDrive, RefreshCw, BrainCircuit, Code2, ImageIcon, Lock, Webhook, Languages, GitBranch
}

async function getLandingData() {
  const entries = await db.contentEntry.findMany({
    where: {
      status: "PUBLISHED",
      contentType: {
        slug: { in: ["noken-hero", "noken-features", "noken-pricing", "noken-addons", "noken-workflow", "noken-faq", "platform-whatsapp"] }
      }
    },
    include: { contentType: true },
    orderBy: { createdAt: "asc" }
  })

  const parseData = (entry: any) => {
    if (!entry) return null
    return typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data
  }

  return {
    hero: parseData(entries.find(e => e.contentType.slug === "noken-hero")),
    features: entries.filter(e => e.contentType.slug === "noken-features").map(parseData),
    pricing: entries.filter(e => e.contentType.slug === "noken-pricing").map(parseData),
    addons: entries.filter(e => e.contentType.slug === "noken-addons").map(parseData),
    workflow: entries.filter(e => e.contentType.slug === "noken-workflow").map(parseData),
    faq: entries.filter(e => e.contentType.slug === "noken-faq").map(parseData),
    whatsapp: parseData(entries.find(e => e.contentType.slug === "platform-whatsapp")),
  }
}

export default async function HomePage() {
  const data = await getLandingData()
  const wa = data.whatsapp || { phone: "6281234567890", message: "Halo!", label: "Chat WhatsApp", is_active: true }

  const formatCurrency = (val: any) => {
    if (!val) return "0"
    // Handle if it's already a string with dots (legacy)
    const cleanStr = val.toString().replace(/\./g, '')
    const num = parseInt(cleanStr, 10)
    if (isNaN(num)) return val
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Fallbacks if data is empty
  const hero = data.hero || {
    badge_text: "🚀 Infrastruktur Digital Karya Anak Papua",
    title: "INFRASTRUKTUR UNTUK Masa Depan.",
    subtitle: "NokenStack adalah Headless CMS berperforma tinggi yang dirancang khusus oleh putra-putri Papua. Solusi modern untuk skalabilitas, keamanan, dan transformasi digital instansi Anda.",
    cta_primary_text: "Mulai Trial Sekarang",
    cta_secondary_text: "Dokumentasi SDK"
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/5 dark:via-background" />
          <div className="container relative text-center">
            <div className="flex flex-col items-center space-y-8 max-w-4xl mx-auto">
              <Badge variant="outline" className="px-4 py-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-medium">
                {hero.badge_text}
              </Badge>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
                {hero.title.split(" ").slice(0, -2).join(" ")}{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent italic font-serif">
                  {hero.title.split(" ").slice(-2).join(" ")}
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed mx-auto">
                {hero.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center">
                <Link href="/register"><Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-10 h-14 text-lg font-bold shadow-xl shadow-emerald-500/20">{hero.cta_primary_text}<ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
                <Link href="/docs"><Button size="lg" variant="outline" className="px-10 h-14 text-lg font-semibold border-2">{hero.cta_secondary_text}</Button></Link>
              </div>
            </div>
          </div>
        </section>

        {/* Logo Cloud Support */}
        <section className="py-12 border-y border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
          <div className="container text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-8">Mendukung Teknologi Frontend Modern</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale">
               {["Next.js", "React", "Vue", "Flutter", "Angular", "Nuxt"].map(tech => (
                 <span key={tech} className="text-xl md:text-2xl font-black tracking-tighter">{tech}</span>
               ))}
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section id="features" className="py-24 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="container">
            <div className="text-center mb-16">
              <Badge className="bg-emerald-500 hover:bg-emerald-600 mb-4 uppercase tracking-widest text-[10px] font-black">Platform</Badge>
              <h2 className="text-4xl font-black tracking-tight mb-4 uppercase text-slate-900 dark:text-white">Kemampuan Platform.</h2>
              <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">Segala yang Anda butuhkan untuk membangun pengalaman digital kelas dunia.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {data.features.filter((f: any) => f.is_main).map((feature: any, i: number) => {
                const Icon = iconMap[feature.icon] || Sparkles
                return (
                  <Card key={i} className="border-none shadow-none bg-white dark:bg-slate-900/50 p-8 rounded-[2.5rem] relative overflow-hidden group border border-slate-100 dark:border-slate-800">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-8 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">{feature.title}</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed font-medium">{feature.description}</p>
                  </Card>
                )
              })}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.features.filter((f: any) => !f.is_main).map((f: any, i: number) => {
                const Icon = iconMap[f.icon] || Zap
                return (
                  <div key={i} className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/30 group hover:border-emerald-500/30 transition-all">
                    <Icon className="w-6 h-6 text-emerald-600 mb-4" />
                    <h4 className="font-bold text-lg mb-2 uppercase tracking-tight text-slate-900 dark:text-white">{f.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 border-y border-slate-100 dark:border-slate-800">
          <div className="container">
            <div className="text-center mb-16">
              <Badge className="bg-emerald-500 hover:bg-emerald-600 mb-4 uppercase tracking-widest text-[10px] font-black">Harga</Badge>
              <h2 className="text-4xl font-black tracking-tight mb-4 uppercase text-slate-900 dark:text-white">Harga Berlangganan Workspace.</h2>
              <p className="text-lg text-muted-foreground font-medium max-w-xl mx-auto">Semua paket termasuk **Free Trial 7 Hari** untuk eksplorasi penuh fitur kami.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
              {data.pricing.map((plan: any, i: number) => (
                <Card key={i} className={`relative p-8 rounded-[2.5rem] transition-all duration-300 border-2 ${plan.is_popular ? 'border-emerald-500 shadow-2xl shadow-emerald-500/10 scale-105 z-10 bg-white dark:bg-slate-900' : 'border-slate-100 dark:border-slate-800 shadow-none'}`}>
                  {plan.is_popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white border-none font-black uppercase tracking-widest text-[10px] px-4 py-1">Paling Populer</Badge>}
                  <div className="mb-8">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-4">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-sm font-bold text-muted-foreground">Rp</span>
                      <span className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">{formatCurrency(plan.price)}</span>
                      <span className="text-sm font-bold text-muted-foreground">/bln</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">{plan.description}</p>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {(Array.isArray(plan.features_list) ? plan.features_list : (typeof plan.features_list === 'string' ? plan.features_list.split(',').map((s: string) => s.trim()) : [])).map((f: string, fi: number) => (
                      <li key={fi} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="block"><Button className={`w-full h-12 font-black uppercase tracking-tighter rounded-xl ${plan.is_popular ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'}`}>{plan.button_text}</Button></Link>
                </Card>
              ))}
            </div>

            {/* Addons Dynamic */}
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-12 rounded-[3rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="max-w-sm text-center md:text-left">
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Layanan Tambahan (Add-ons)</h3>
                  <p className="text-muted-foreground font-medium">Tingkatkan kapabilitas node Anda dengan fitur spesifik sesuai kebutuhan.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-6 w-full md:w-auto flex-1 md:ml-12">
                  {data.addons.map((addon: any, i: number) => {
                    const Icon = iconMap[addon.icon] || HardDrive
                    return (
                      <div key={i} className="flex flex-col items-center md:items-start text-center md:text-left gap-3 group">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm uppercase tracking-tight">{addon.title}</h4>
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1">{addon.price_label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{addon.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cara Kerja */}
        <section id="workflow" className="py-24">
          <div className="container">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase text-slate-900 dark:text-white">Cara Kerja.</h2>
              <p className="text-muted-foreground max-w-xl mx-auto font-medium text-lg">Hanya 3 langkah sederhana untuk online.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              {data.workflow.map((item: any, i: number) => {
                const Icon = iconMap[item.icon] || Layout
                return (
                  <div key={i} className="relative flex flex-col items-center text-center group">
                    <div className="text-7xl font-black text-slate-100 dark:text-slate-900 absolute -top-10 -z-10 group-hover:text-emerald-500/10 transition-colors">{item.step}</div>
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/30"><Icon className="w-8 h-8" /></div>
                    <h3 className="text-xl font-black mb-4 uppercase tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">{item.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 bg-slate-50/50 dark:bg-slate-900/20 border-y border-slate-100 dark:border-slate-800">
          <div className="container max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase text-slate-900 dark:text-white">Pertanyaan Umum.</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {data.faq.map((faq: any, i: number) => (
                <Card key={i} className="p-6 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-emerald-500/30 transition-all rounded-[2rem]">
                  <h4 className="font-black text-lg mb-3 uppercase tracking-tight flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    {faq.question}
                  </h4>
                  <p className="text-muted-foreground font-medium leading-relaxed ml-8">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32">
          <div className="container">
            <div className="bg-slate-900 rounded-[4rem] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 opacity-20" 
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20L0 0h40L20 20z' fill='%2310b981' fill-rule='evenodd'/%3E%3C/svg%3E")` }} 
               />
               <div className="relative z-10 space-y-10">
                 <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase">SIAP MEMBANGUN <br /> <span className="text-emerald-500">PAPUA DIGITAL?</span></h2>
                 <p className="text-slate-400 text-xl font-medium max-w-2xl mx-auto leading-relaxed">Bergabunglah sekarang dan nikmati masa trial 7 hari untuk semua paket.</p>
                 <div className="flex flex-col sm:flex-row gap-6 justify-center">
                    <Link href="/register"><Button size="lg" className="h-16 px-14 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl font-black text-xl transition-transform hover:scale-105">Mulai Trial Sekarang</Button></Link>
                    <Link href="/contact"><Button size="lg" variant="outline" className="h-16 px-14 border-white/20 text-white hover:bg-white/10 rounded-2xl font-black text-xl">Hubungi Tim Kami</Button></Link>
                 </div>
               </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-16 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center"><Database className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-xl tracking-tighter uppercase text-slate-900 dark:text-white">NokenStack</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium italic text-center">© {new Date().getFullYear()} NokenStack Engineering. Dibuat dengan ❤️ oleh Anak Papua.</p>
          <div className="flex gap-8 grayscale opacity-50">
             <span className="text-[10px] font-black tracking-widest italic">#PAPUADIGITAL</span>
             <span className="text-[10px] font-black tracking-widest italic">#SACODE</span>
          </div>
        </div>
      </footer>

      <WhatsAppButton 
        phone={wa.phone} 
        message={wa.message} 
        label={wa.label} 
        isActive={wa.is_active} 
      />
    </div>
  )
}
