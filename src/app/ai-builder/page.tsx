import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { Sparkles, Wand2 } from "lucide-react"

export default async function AIBuilderPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login?callbackUrl=/ai-builder")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center p-3 bg-zinc-900 rounded-2xl mb-4 border border-zinc-800 shadow-2xl">
          <Sparkles className="w-8 h-8 text-orange-500" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
          What do you want to build?
        </h1>
        
        <p className="text-zinc-400 text-lg md:text-xl font-medium max-w-2xl mx-auto">
          Describe any website you want to build. Our AI will automatically design the database schema, setup your workspace, and write the frontend code.
        </p>

        <form className="relative max-w-2xl mx-auto mt-12" action="/ai-builder/new" method="GET">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Wand2 className="w-6 h-6 text-zinc-500" />
          </div>
          <input
            type="text"
            name="prompt"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-6 pl-14 pr-32 text-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-2xl"
            placeholder="A modern blog for a coffee shop..."
            required
            autoComplete="off"
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            <button
              type="submit"
              className="bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-orange-500 hover:text-white transition-colors"
            >
              Generate
            </button>
          </div>
        </form>

        <div className="mt-16 flex flex-wrap justify-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Try these:</span>
          <a href="/ai-builder/new?prompt=A+portfolio+for+a+freelance+photographer" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">Photography Portfolio</a>
          <span className="text-zinc-700">•</span>
          <a href="/ai-builder/new?prompt=A+help+center+for+a+SaaS+company" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">SaaS Help Center</a>
          <span className="text-zinc-700">•</span>
          <a href="/ai-builder/new?prompt=A+landing+page+for+a+fitness+gym+with+trainers" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">Gym Landing Page</a>
        </div>
      </div>
    </div>
  )
}
