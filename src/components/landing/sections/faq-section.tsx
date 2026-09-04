"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { FaqItem } from "../types"

export function FaqSection({ faq = [] }: { faq?: FaqItem[] }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const defaultFaq: FaqItem[] = [
    {
      question: "Apa itu SaCMS (Smart Content Management System)?",
      answer: "SaCMS adalah Smart Content Management System headless multi-tenant modern berbasis Next.js 16 dan PostgreSQL 17. SaCMS memisahkan penyimpanan data dari frontend untuk memberikan kebebasan penuh dalam mendistribusikan konten.",
    },
    {
      question: "Bagaimana cara kerja Dedicated VPS/VDS?",
      answer: "Saat Anda berlangganan paket Cloud VPS atau Gov VDS, sistem kami secara otomatis mem-provisioning server cloud terisolasi dengan database PostgreSQL 17, Object Storage S3, dan hosting frontend khusus untuk workspace Anda.",
    },
    {
      question: "Metode pembayaran apa saja yang didukung?",
      answer: "Kami mendukung seluruh pembayaran lokal via Midtrans: QRIS, GoPay, OVO, ShopeePay, Transfer Bank (BCA, Mandiri, BNI, BRI, Permata), dan Kartu Kredit Visa/Mastercard.",
    },
    {
      question: "Apakah saya bisa menggunakan database PostgreSQL saya sendiri (BYODB)?",
      answer: "Ya! Anda dapat memasukkan string koneksi PostgreSQL Anda sendiri (seperti Supabase, Neon, AWS RDS) langsung di menu Pengaturan Workspace.",
    },
  ]

  const activeFaq = faq && faq.length > 0 ? faq : defaultFaq

  return (
    <section id="faq" className="py-24 sm:py-32 relative bg-card/30 border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Pertanyaan Umum
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-2xl mx-auto">
            Semua yang Perlu Anda Ketahui
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            Pertanyaan yang sering diajukan seputar platform, keamanan, dan metode pembayaran.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {activeFaq.map((item, i) => {
            const isOpen = openFaq === i
            return (
              <div 
                key={i} 
                className={`group border border-border/50 rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen 
                    ? "bg-card/80 shadow-md shadow-primary/5 border-primary/30 backdrop-blur-xl" 
                    : "bg-card/30 hover:bg-card/50 hover:border-primary/20 backdrop-blur-md"
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left transition-colors cursor-pointer"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <span className={`text-base sm:text-lg font-bold pr-4 transition-colors ${isOpen ? 'text-primary' : 'text-foreground group-hover:text-primary/80'}`}>
                    {item.question}
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'}`}>
                    <ChevronDown className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isOpen ? "rotate-180 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                  </div>
                </button>
                <div 
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                      <div 
                        className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium [&>p]:mb-0 [&_p]:mb-0"
                        dangerouslySetInnerHTML={{ __html: item.answer || "" }}
                      />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
