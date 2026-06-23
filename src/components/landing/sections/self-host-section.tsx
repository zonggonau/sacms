import { Terminal, CheckCircle2, Server, ShieldCheck, Cpu } from "lucide-react"

export function SelfHostSection() {
  const steps = [
    {
      title: "1. Siapkan Server & Environment",
      desc: "Clone repository SaCMS dan atur environment variables Anda.",
      code: `git clone git@github.com:zonggonau/sacms.git\ncd sacms\ncp .env.example .env\n# Pastikan SELFHOST_MODE="true"`
    },
    {
      title: "2. Jalankan Script Setup Otomatis",
      desc: "Gunakan script interaktif untuk melakukan setup awal.",
      code: `bun run scripts/selfhost-setup.ts`
    },
    {
      title: "3. Deploy via Docker",
      desc: "Server siap dijalankan di production menggunakan Docker Compose.",
      code: `bash scripts/docker-selfhost-setup.sh`
    }
  ]

  const features = [
    { icon: <ShieldCheck className="w-5 h-5" />, title: "Data Isolation", desc: "Data 100% tersimpan di infrastruktur Anda sendiri." },
    { icon: <Cpu className="w-5 h-5" />, title: "Tanpa Limit", desc: "Dapatkan batas maksimal workspace dan data tanpa biaya tambahan bulanan." },
    { icon: <Server className="w-5 h-5" />, title: "Integrasi Internal", desc: "Akses DB langsung secara aman untuk keperluan analitik internal." },
  ]

  return (
    <section id="self-host" className="py-32 relative bg-zinc-950 text-zinc-50 border-t border-zinc-900 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-widest">
            Enterprise Self-Host
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-zinc-50 mb-6 tracking-tight">
            Kendalikan Penuh Data Anda
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto font-medium">
            Deploy SaCMS secara mandiri di infrastruktur cloud perusahaan Anda. Nikmati kontrol total, keamanan maksimal, dan tanpa batasan paket bulanan SaaS.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Features & Info */}
          <div className="lg:col-span-5 space-y-10">
            <div>
              <h3 className="text-2xl font-bold mb-4">Mengapa Self-Hosted?</h3>
              <p className="text-zinc-400 leading-relaxed">
                Lisensi Enterprise kami memungkinkan Anda menginstall keseluruhan sistem Headless CMS kami di server Anda (On-Premise / Private Cloud). 
                Landing page SaaS publik akan disembunyikan dan sistem akan berjalan murni sebagai CMS internal yang siap diintegrasikan.
              </p>
            </div>

            <div className="space-y-6">
              {features.map((f, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-orange-500">
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-100">{f.title}</h4>
                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Terminal Instructions */}
          <div className="lg:col-span-7">
            <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs font-mono text-zinc-500 flex items-center gap-2">
                  <Terminal className="w-3 h-3" /> sacms-installation
                </span>
              </div>
              
              <div className="p-6 space-y-8">
                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">{step.title}</h4>
                      <p className="text-sm text-zinc-500">{step.desc}</p>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm font-mono text-orange-400 whitespace-pre-wrap break-all leading-relaxed">
                        {step.code.split('\n').map((line, i) => (
                          <div key={i} className="flex gap-4">
                            <span className="text-zinc-700 select-none">$</span>
                            <span>{line}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                ))}
                
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex gap-3 items-start mt-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-green-400">Selesai! SaCMS berjalan di port 3000.</h5>
                    <p className="text-xs text-green-500/80 mt-1">Akses root domain Anda, dan sistem akan langsung mengarahkan Anda ke portal admin CMS tanpa mengekspos halaman marketing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
