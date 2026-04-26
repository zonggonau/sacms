import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Database, 
  Code2, 
  Users, 
  Zap, 
  Shield, 
  Globe, 
  ArrowRight,
  Check,
  GitBranch,
  Languages,
  Webhook,
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
  HardDrive,
  RefreshCw,
  BrainCircuit,
  Star
} from "lucide-react"
import Link from "next/link"
import { LandingHeader } from "@/components/landing/header"
import { db } from "@/lib/database"

import { WhatsAppButton } from "@/components/landing/whatsapp-button"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SaCMS - Colorful Minimalist Headless CMS",
  description: "A vibrant, high-performance headless CMS with AI capabilities and multi-tenant architecture.",
}

const iconMap: Record<string, any> = {
  Sparkles, Cpu, Layout, Code2, Zap, Monitor, Smartphone, Server, HelpCircle, 
  HardDrive, RefreshCw, BrainCircuit, ImageIcon, Lock, Webhook, Languages, GitBranch, Users, Shield, Globe, Image: ImageIcon, ImageIcon: ImageIcon
}

async function getLandingData() {
  const globalTenant = await db.tenant.findFirst({
    where: { slug: "sacms-global" }
  })

  const entries = await db.contentEntry.findMany({
    where: {
      status: "PUBLISHED",
      tenantId: globalTenant?.id,
      contentType: {
        slug: { in: ["sacms-hero", "sacms-features", "sacms-pricing", "sacms-addons", "sacms-workflow", "sacms-faq", "sacms-whatsapp", "sacms-about", "sacms-owners", "sacms-testimonials"] }
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
    hero: parseData(entries.find(e => e.contentType.slug === "sacms-hero")),
    features: entries.filter(e => e.contentType.slug === "sacms-features").map(parseData),
    pricing: entries.filter(e => e.contentType.slug === "sacms-pricing").map(parseData),
    addons: entries.filter(e => e.contentType.slug === "sacms-addons").map(parseData),
    workflow: entries.filter(e => e.contentType.slug === "sacms-workflow").map(parseData),
    faq: entries.filter(e => e.contentType.slug === "sacms-faq").map(parseData),
    whatsapp: parseData(entries.find(e => e.contentType.slug === "sacms-whatsapp")),
    about: parseData(entries.find(e => e.contentType.slug === "sacms-about")),
    owners: entries.filter(e => e.contentType.slug === "sacms-owners").map(parseData),
    testimonials: entries.filter(e => e.contentType.slug === "sacms-testimonials").map(parseData),
  }
}

export default async function HomePage() {
  const data = await getLandingData()
  const wa = data.whatsapp || { phone: "6281234567890", message: "Halo!", label: "Chat WhatsApp", is_active: true }
  const about = data.about || { title: "Misi SaCMS", content: "Membangun masa depan digital Papua.", image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80" }
  const owners = data.owners || []
  const testimonials = data.testimonials || []

  const formatCurrency = (val: any) => {
    if (!val) return "0"
    const cleanStr = val.toString().replace(/\./g, '')
    const num = parseInt(cleanStr, 10)
    if (isNaN(num)) return val
    return new Intl.NumberFormat('id-ID').format(num)
  }

  const hero = data.hero || {
    badge_text: "Infrastruktur Digital Modern",
    title: "Headless CMS untuk Organisasi Modern",
    subtitle: "SaCMS menyediakan fondasi digital yang kuat untuk mengelola konten di berbagai platform dengan arsitektur multi-tenant yang aman dan efisien.",
    cta_primary_text: "Mulai Sekarang",
    cta_secondary_text: "Dokumentasi"
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 font-sans text-sm selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      <LandingHeader />

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 md:pt-36 md:pb-36 border-b border-zinc-100 dark:border-zinc-900">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
             <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] bg-emerald-100/40 dark:bg-emerald-900/10 blur-[120px] rounded-full" />
             <div className="absolute top-[10%] -right-[10%] w-[40%] h-[50%] bg-indigo-100/40 dark:bg-indigo-900/10 blur-[120px] rounded-full" />
          </div>
          
          <div className="container px-6 max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-widest">{hero.badge_text}</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1] max-w-4xl uppercase">
                {hero.title.split(" ").slice(0, -2).join(" ")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-indigo-600">
                  {hero.title.split(" ").slice(-2).join(" ")}
                </span>
              </h1>
              
              <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed font-medium">
                {hero.subtitle}
              </p>
              
              <div className="flex items-center gap-4 pt-4">
                <Link href="/register">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 px-8 h-12 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all hover:scale-105">
                    {hero.cta_primary_text}
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button size="sm" variant="ghost" className="px-8 h-12 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                    {hero.cta_secondary_text} <ArrowRight className="ml-2 w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section id="features" className="py-24 border-b border-zinc-100 dark:border-zinc-900 relative">
          <div className="absolute bottom-0 right-0 w-[30%] h-[40%] bg-blue-50/50 dark:bg-blue-900/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="container px-6 max-w-5xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-16">
              <div className="md:col-span-1 space-y-6">
                <Badge className="bg-emerald-500 text-white border-none uppercase tracking-[0.2em] text-[9px] font-black px-3 py-1">Capabilities</Badge>
                <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none uppercase">Esensi Pengelolaan Konten.</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  Didesain untuk performa tinggi dengan infrastruktur yang fleksibel dan skalabel.
                </p>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-12">
                {data.features.map((feature: any, i: number) => {
                  const Icon = iconMap[feature.icon] || Sparkles
                  const colors = [
                    "text-emerald-500 bg-emerald-50",
                    "text-blue-500 bg-blue-50",
                    "text-indigo-500 bg-indigo-50",
                    "text-amber-500 bg-amber-50",
                    "text-rose-500 bg-rose-50",
                    "text-violet-500 bg-violet-50"
                  ]
                  const colorClass = colors[i % colors.length]
                  return (
                    <div key={i} className="space-y-4 group">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${colorClass.split(" ")[1]} dark:bg-zinc-900`}>
                        <Icon className={`w-5 h-5 ${colorClass.split(" ")[0]}`} />
                      </div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{feature.title}</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">{feature.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-24 border-b border-zinc-100 dark:border-zinc-900 bg-indigo-50/20 dark:bg-indigo-900/5 relative overflow-hidden">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[20%] h-[60%] bg-indigo-200/20 blur-[100px] rounded-full" />
          
          <div className="container px-6 max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-20">
              <div className="flex-1 space-y-8">
                <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50/50 uppercase tracking-[0.3em] text-[9px] font-black px-3 py-1">Misi Kami</Badge>
                <h3 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter leading-[0.9] uppercase">
                  {about.title}
                </h3>
                <p className="text-base text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium italic border-l-4 border-indigo-500 pl-6">
                  {about.content}
                </p>
                <div className="pt-4">
                  <Link href="/register" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:gap-4 transition-all group">
                    Daftar Sekarang <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0 bg-indigo-600 rotate-3 rounded-2xl opacity-10" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-900">
                  <img src={about.image} alt="About SaCMS" className="w-full h-auto object-cover aspect-[16/10] hover:scale-105 transition-transform duration-700" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 border-b border-zinc-100 dark:border-zinc-900 relative">
          <div className="absolute top-0 right-[10%] w-[30%] h-[30%] bg-amber-50/50 dark:bg-amber-900/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="container px-6 max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-20 space-y-4">
              <Badge className="bg-amber-500 text-white border-none uppercase tracking-[0.2em] text-[9px] font-black px-4 py-1">Pricing</Badge>
              <h3 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none uppercase">Rencana Berlangganan.</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium italic">Termasuk Free Trial selama 7 hari penuh.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {data.pricing.map((plan: any, i: number) => (
                <div key={i} className={`p-10 rounded-[2rem] border-2 flex flex-col transition-all group hover:-translate-y-2 ${plan.is_popular ? 'border-amber-500 bg-white dark:bg-zinc-900 shadow-2xl shadow-amber-500/10' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30'}`}>
                  {plan.is_popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white font-black uppercase tracking-widest text-[8px] px-4 py-1 rounded-full border-none">Most Popular</Badge>}
                  
                  <div className="mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-8 italic">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-xs font-black text-amber-600 mr-1">Rp</span>
                      <span className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100">{formatCurrency(plan.price)}</span>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">/ mo</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-bold">{plan.description}</p>
                  </div>
                  
                  <ul className="space-y-5 mb-12 flex-1">
                    {(Array.isArray(plan.features_list) ? plan.features_list : (typeof plan.features_list === 'string' ? plan.features_list.split(',').map((s: string) => s.trim()) : [])).map((f: string, fi: number) => (
                      <li key={fi} className="flex items-start gap-3 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                           <Check className="w-2.5 h-2.5 text-emerald-600" />
                        </div>
                        <span className="leading-tight">{f}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link href={`/register?plan=${plan.name.toLowerCase()}`}>
                    <Button size="sm" className={`w-full h-12 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg ${plan.is_popular ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-zinc-900/10'}`}>
                      {plan.button_text}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <section className="py-24 border-b border-zinc-100 dark:border-zinc-900 bg-emerald-500 text-white">
            <div className="container px-6 max-w-5xl mx-auto">
              <div className="grid md:grid-cols-3 gap-10">
                {testimonials.map((t: any, i: number) => (
                  <div key={i} className="space-y-8 p-8 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-sm">
                    <div className="flex gap-0.5 text-emerald-300">
                       {[...Array(5)].map((_, si) => <Star key={si} className="w-3 h-3 fill-current" />)}
                    </div>
                    <p className="text-sm italic leading-relaxed font-bold">"{t.content}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 overflow-hidden shadow-lg">
                        <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-tight">{t.name}</h4>
                        <p className="text-[9px] text-emerald-200 font-black uppercase tracking-widest">{t.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Owners Section */}
        <section id="owners" className="py-24 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
          <div className="container px-6 max-w-5xl mx-auto">
             <div className="text-center mb-16 space-y-2">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em]">Arsitek Platform</h3>
             </div>
             <div className="grid md:grid-cols-2 gap-12">
               {owners.map((owner: any, i: number) => (
                 <div key={i} className="flex gap-10 items-center p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-xl group">
                    <div className="shrink-0 relative">
                      <div className="absolute inset-0 bg-emerald-500 rounded-2xl rotate-6 opacity-10 group-hover:rotate-12 transition-transform" />
                      <img src={owner.avatar} alt={owner.name} className="relative w-24 h-24 rounded-2xl border-2 border-white dark:border-zinc-800 shadow-xl object-cover" />
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white leading-none mb-1">{owner.name}</h4>
                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">{owner.role}</p>
                      </div>
                      <div 
                        className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed italic opacity-80 line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: owner.bio }}
                      />
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-40 relative bg-zinc-900 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" 
               style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(16,185,129,0.3) 1px, transparent 0)`, backgroundSize: '24px 24px' }} 
          />
          <div className="absolute -top-[50%] -right-[20%] w-[60%] h-[100%] bg-emerald-600/10 blur-[150px] rounded-full" />
          
          <div className="container px-6 max-w-4xl mx-auto text-center space-y-12 relative z-10">
             <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.85] uppercase">
                Siap membangun <br /> <span className="text-emerald-500 italic font-serif lowercase">Papua Digital?</span>
             </h2>
             <p className="text-base md:text-xl text-zinc-400 font-medium italic max-w-2xl mx-auto">
                Nikmati masa uji coba gratis selama 7 hari untuk semua paket. <br /> Hubungkan konten Anda ke masa depan hari ini.
             </p>
             <div className="flex flex-col sm:flex-row justify-center gap-6 pt-6">
                <Link href="/register">
                  <Button size="lg" className="h-16 px-12 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-emerald-600/20 transition-all hover:scale-105">
                    Mulai Sekarang
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="h-16 px-12 border-white/20 text-white hover:bg-white/10 text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all">
                    Hubungi Tim
                  </Button>
                </Link>
             </div>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950">
        <div className="container px-6 max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                <Database className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-lg tracking-tighter uppercase text-zinc-900 dark:text-white">SaCMS</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Crafted in Jayapura, Papua.</p>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-4 text-center md:text-right">
             <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                © {new Date().getFullYear()} SaCMS Engineering.
             </p>
             <div className="flex gap-8 opacity-30">
                <span className="text-[9px] font-black tracking-[0.4em] uppercase italic text-emerald-600">#PapuaDigital</span>
                <span className="text-[9px] font-black tracking-[0.4em] uppercase italic text-zinc-500">#SaCode</span>
             </div>
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
