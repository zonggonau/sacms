import Image from "next/image"
import type { OwnerItem } from "../types"

export function TeamSection({ owners }: { owners: OwnerItem[] }) {
  if (owners.length === 0) return null

  return (
    <section id="team" className="py-32 relative bg-card/40 border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/40 to-transparent blur-3xl rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Tim Kami
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            Para Pembangun <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Papua Digital</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Di balik teknologi canggih ini, ada tim lokal yang berdedikasi tinggi untuk memajukan daerah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {owners.map((owner, i) => (
            <div 
              key={i} 
              className="group relative flex flex-col items-center text-center p-8 sm:p-10 rounded-[2.5rem] bg-background border border-border/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30"
            >
              {/* Subtle Glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-[2.5rem]" />
              </div>

              <div className="relative mb-6">
                {/* Decorative rings */}
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 scale-110 group-hover:scale-125 group-hover:border-primary/40 transition-all duration-500" />
                <div className="absolute inset-0 rounded-full border border-primary/10 scale-125 group-hover:scale-150 group-hover:border-transparent transition-all duration-700" />
                
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background relative shadow-xl shadow-primary/20 group-hover:shadow-primary/40 transition-shadow duration-500 z-10 bg-primary/5">
                  <Image
                    src={owner.avatar_url || "https://i.pravatar.cc/150"}
                    alt={owner.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
              </div>
              
              <div className="relative z-10 w-full">
                <h3 className="text-2xl font-black text-foreground mb-1 group-hover:text-primary transition-colors">{owner.name}</h3>
                <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 mb-5 tracking-wide uppercase">{owner.role}</p>
                <p className="text-base text-muted-foreground leading-relaxed mb-6 font-medium">{owner.bio}</p>
                
                {owner.linkedin && (
                  <div className="flex justify-center mt-auto">
                    <a 
                      href={owner.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg shadow-primary/30"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
