"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowRight, Check, Database, Zap, 
  Shield, Globe, Code2, Users,
  ChevronRight, Star, Quote
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const iconMap: Record<string, any> = {
  Database, Zap, Shield, Globe, Code2, Users
}

export function LandingClient({ 
  hero, 
  features, 
  testimonials, 
  pricingPlans 
}: { 
  hero: any, 
  features: any[], 
  testimonials: any[],
  pricingPlans: any[] 
}) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        <div className="container relative mx-auto px-6">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-4xl mx-auto text-center space-y-8"
          >
            <motion.div variants={itemVariants}>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                {hero?.badge || "Next-Gen Headless CMS"}
              </Badge>
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1]"
            >
              {hero?.title || "Architect Your Content With AI"}
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed"
            >
              {hero?.subtitle || "The enterprise-ready multi-tenant headless CMS designed for modern startups. Scale your content ecosystem across multiple workspaces effortlessly."}
            </motion.p>
            
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <Button asChild size="lg" className="h-14 px-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20">
                <Link href="/register">Get Started Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-10 rounded-2xl border-white/10 bg-card/5 hover:bg-card/10 text-white font-black uppercase tracking-widest text-sm">
                <Link href="#features">Explore Features</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Core Capabilities</h2>
            <h3 className="text-4xl font-black tracking-tight">Everything You Need To Scale</h3>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, i) => {
              const Icon = iconMap[feature.icon] || Database
              return (
                <motion.div key={i} variants={itemVariants}>
                  <Card className="h-full border-none shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 bg-muted/30 rounded-[2rem] overflow-hidden group">
                    <CardContent className="p-8 space-y-6">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-500">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold">{feature.title}</h4>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-zinc-950 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 blur-[120px] rounded-full" />
        </div>
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-20">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Wall of Love</h2>
            <h3 className="text-4xl font-black tracking-tight">Trusted By Content Teams Worldwide</h3>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={itemVariants} className="p-8 rounded-[2.5rem] bg-card/5 border border-white/10 space-y-6 relative group hover:bg-card/10 transition-colors">
                <Quote className="absolute top-8 right-8 h-10 w-10 text-emerald-500/20" />
                <div className="flex gap-1 text-emerald-400">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-current" />)}
                </div>
                <p className="text-lg font-medium leading-relaxed italic text-zinc-200">
                  "{t.content}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.role || "Product Lead"}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background dark:bg-zinc-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Investment</h2>
            <h3 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">Simple, transparent pricing</h3>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {pricingPlans.map((plan, i) => (
              <motion.div key={i} variants={itemVariants} className="flex h-full">
                <Card className={cn(
                  "flex flex-col w-full rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 group",
                  plan.is_popular 
                    ? "border-emerald-500 shadow-2xl shadow-emerald-500/10 bg-card scale-105 z-10" 
                    : "border-muted bg-card/50 hover:border-emerald-200"
                )}>
                  {plan.is_popular && (
                    <div className="bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-[0.2em] text-center py-2.5">
                      Most Popular
                    </div>
                  )}
                  <div className="p-8 space-y-6 flex-1 flex flex-col">
                    <div className="space-y-2">
                      <h4 className="text-xl font-black uppercase tracking-tight">{plan.name}</h4>
                      <p className="text-xs font-medium text-muted-foreground leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="py-4">
                      <span className="text-5xl font-black tracking-tighter">
                        {Number(plan.price) === 0 ? "Free" : `$${plan.price}`}
                      </span>
                      {Number(plan.price) > 0 && <span className="text-muted-foreground text-sm font-bold ml-1">/mo</span>}
                    </div>
                    
                    <div className="space-y-4 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">What's included:</p>
                      <ul className="space-y-3.5">
                        {plan.features.map((feature: string, fi: number) => (
                          <li key={fi} className="flex items-start gap-3">
                            <div className="mt-1 bg-emerald-500/10 rounded-full p-0.5">
                              <Check className="w-3 h-3 text-emerald-600" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button asChild className={cn(
                      "w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all",
                      plan.is_popular 
                        ? "bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-emerald-500/20" 
                        : "bg-zinc-900 dark:bg-card text-white dark:text-zinc-950 hover:opacity-90"
                    )}>
                      <Link href="/register">{plan.buttonText || "Get Started"}</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
