"use client"

import Image from "next/image"
import type { OwnerItem } from "../types"
import { useLanguage } from "@/lib/i18n/context"

export function TeamSection({ owners }: { owners: OwnerItem[] }) {
  const { dict } = useLanguage()

  if (owners.length === 0) return null

  return (
    <section id="team" className="py-24 sm:py-32 relative bg-card/40 border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/40 to-transparent blur-3xl rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            {dict.team.badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-2xl mx-auto">
            {dict.team.title}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            {dict.team.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {owners.map((owner, i) => (
            <div 
              key={i} 
              className="group relative flex flex-col items-center text-center p-6 sm:p-8 rounded-3xl bg-background border border-border/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30"
            >
              {/* Subtle Glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl" />
              </div>

              <div className="relative mb-5">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-background relative shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow z-10 bg-primary/5">
                  <Image
                    src={owner.avatar_url || "https://i.pravatar.cc/150"}
                    alt={owner.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
              
              <div className="relative z-10 w-full">
                <h3 className="text-lg sm:text-xl font-black text-foreground mb-1 group-hover:text-primary transition-colors">{owner.name}</h3>
                <p className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 mb-4 tracking-wide uppercase">{owner.role}</p>
                <div 
                  className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium [&>p]:mb-0 [&_p]:mb-0"
                  dangerouslySetInnerHTML={{ __html: owner.bio || "" }}
                />
                
                {owner.linkedin && (
                  <div className="flex justify-center mt-auto">
                    <a 
                      href={owner.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all hover:scale-110 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
