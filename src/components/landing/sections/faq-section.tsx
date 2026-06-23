"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { FaqItem } from "../types"

export function FaqSection({ faq }: { faq: FaqItem[] }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0) // Default open first one

  if (faq.length === 0) return null

  return (
    <section id="faq" className="py-32 relative bg-card/30 border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Tanya Jawab
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            Pertanyaan yang <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Sering Diajukan</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Temukan jawaban untuk semua keraguan Anda tentang platform kami.
          </p>
        </div>

        <div className="space-y-4">
          {faq.map((item, i) => {
            const isOpen = openFaq === i
            return (
              <div 
                key={i} 
                className={`group border border-border/50 rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen 
                    ? "bg-card/80 shadow-lg shadow-primary/5 border-primary/30 backdrop-blur-xl" 
                    : "bg-card/30 hover:bg-card/50 hover:border-primary/20 backdrop-blur-md"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between p-6 text-left transition-colors"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <span className={`text-lg font-bold pr-4 transition-colors ${isOpen ? 'text-primary' : 'text-foreground group-hover:text-primary/80'}`}>
                    {item.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'}`}>
                    <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? "rotate-180 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                  </div>
                </button>
                <div 
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6 text-base text-muted-foreground leading-relaxed font-medium">
                      {item.answer}
                    </div>
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
