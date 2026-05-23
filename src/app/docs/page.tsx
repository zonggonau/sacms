import { LandingHeader } from "@/components/landing/header"
import { Copy, Terminal, Key, Database, ChevronRight } from "lucide-react"

export const metadata = {
  title: "API Documentation | SaCMS",
  description: "REST API Documentation for SaCMS",
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <LandingHeader />

      <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
        {/* Sidebar */}
        <aside className="md:w-64 shrink-0">
          <div className="sticky top-28 space-y-6">
            <div>
              <h4 className="font-semibold text-sm tracking-wide text-zinc-900 dark:text-zinc-100 uppercase mb-3">Getting Started</h4>
              <ul className="space-y-2">
                <li><a href="#introduction" className="text-zinc-600 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 text-sm font-medium transition-colors">Introduction</a></li>
                <li><a href="#authentication" className="text-zinc-600 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 text-sm font-medium transition-colors">Authentication</a></li>
                <li><a href="#sdk" className="text-zinc-600 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 text-sm font-medium transition-colors">SDK (TypeScript)</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm tracking-wide text-zinc-900 dark:text-zinc-100 uppercase mb-3">REST API</h4>
              <ul className="space-y-2">
                <li><a href="#content-api" className="text-zinc-600 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 text-sm font-medium transition-colors">Content API</a></li>
                <li><a href="#single-types" className="text-zinc-600 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 text-sm font-medium transition-colors">Single Types API</a></li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 space-y-16">
          {/* Introduction */}
          <section id="introduction" className="scroll-mt-28">
            <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">REST API Documentation</h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
              SaCMS provides a powerful, read-only public REST API to fetch your managed content securely.
              Built for speed and flexibility, it supports advanced filtering, pagination, and population.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <Terminal className="w-5 h-5 text-zinc-500" />
              <code className="text-sm font-mono text-zinc-800 dark:text-zinc-200">Base URL: https://[your-domain]/api/public/[tenant]</code>
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Authentication */}
          <section id="authentication" className="scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-lg">
                <Key className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Authentication</h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              All public API requests must include your API key in the headers. You can generate API keys from your SaCMS Dashboard under the <strong>Developer</strong> settings.
            </p>
            <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-zinc-950">
                <span className="text-xs font-medium text-zinc-400">Headers</span>
              </div>
              <pre className="p-4 overflow-x-auto">
                <code className="text-sm font-mono text-green-400">
                  x-api-key: your_api_key_here
                </code>
              </pre>
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* SDK */}
          <section id="sdk" className="scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg">
                <Terminal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">SDK (TypeScript)</h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              The official SaCMS TypeScript SDK provides a fluent query builder and built-in rate-limit handling. It's the recommended way to fetch data in Next.js, React, or Node.js.
            </p>
            <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-zinc-950">
                <span className="text-xs font-medium text-zinc-400">Example Usage</span>
              </div>
              <pre className="p-4 overflow-x-auto">
                <code className="text-sm font-mono text-zinc-300">
<span className="text-pink-400">import</span> {'{'} SaCMS {'}'} <span className="text-pink-400">from</span> <span className="text-green-300">'@sacms/sdk'</span>{'\n\n'}
<span className="text-zinc-500">// Initialize client</span>{'\n'}
<span className="text-pink-400">const</span> sacms = <span className="text-pink-400">new</span> SaCMS({'{'}{'\n'}
{'  '}baseUrl: <span className="text-green-300">'https://api.yourdomain.com'</span>,{'\n'}
{'  '}tenant: <span className="text-green-300">'your-tenant-slug'</span>,{'\n'}
{'  '}token: <span className="text-green-300">'your-api-key'</span>{'\n'}
{'}'}){'\n\n'}
<span className="text-zinc-500">// Fluent Query Builder</span>{'\n'}
<span className="text-pink-400">const</span> response = <span className="text-pink-400">await</span> sacms.collection(<span className="text-green-300">'articles'</span>){'\n'}
{'  '}.query(){'\n'}
{'  '}.where(<span className="text-green-300">'status'</span>, <span className="text-green-300">'eq'</span>, <span className="text-green-300">'PUBLISHED'</span>){'\n'}
{'  '}.populate([<span className="text-green-300">'author'</span>]){'\n'}
{'  '}.limit(<span className="text-blue-300">10</span>){'\n'}
{'  '}.fetch()
                </code>
              </pre>
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Content API */}
          <section id="content-api" className="scroll-mt-28">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Content API</h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Fetch multiple entries of a specific Content Type (Collection). Supports Strapi-like filtering operators.
            </p>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded">GET</span>
                <code className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">/content/[contentTypeSlug]</code>
              </div>

              <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-sm mt-4">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
                  <span className="text-xs font-medium text-zinc-400">Example Request</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-300">
                  <code>
                    <span className="text-pink-400">fetch</span>(<span className="text-green-300">'/api/public/my-tenant/content/articles?filters[title][$contains]=Next.js&limit=10'</span>, {'{'}
                    {"\n  "}headers: {'{'}
                    {"\n    "}<span className="text-blue-300">'x-api-key'</span>: <span className="text-green-300">'...'</span>
                    {"\n  "}{'}'}
                    {'\n}'})
                  </code>
                </pre>
              </div>

              <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-sm mt-4">
                <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-zinc-950">
                  <span className="text-xs font-medium text-zinc-400">Response</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-300">
                  <code>
                    {`{
  "data": [
    {
      "id": "cm...123",
      "data": {
        "title": "Learning Next.js 16",
        "slug": "learning-nextjs-16"
      },
      "status": "PUBLISHED",
      "createdAt": "2026-05-21T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}`}
                  </code>
                </pre>
              </div>
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Single Types */}
          <section id="single-types" className="scroll-mt-28">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Single Types API</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Fetch data for Single Types (e.g., Global Settings, Homepage configuration).
            </p>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded">GET</span>
                <code className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">/single/[singleTypeSlug]</code>
              </div>

              <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-sm mt-4">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
                  <span className="text-xs font-medium text-zinc-400">Example Request</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-300">
                  <code>
                    <span className="text-pink-400">fetch</span>(<span className="text-green-300">'/api/public/my-tenant/single/global-settings'</span>, {'{'}
                    {"\n  "}headers: {'{'} <span className="text-blue-300">'x-api-key'</span>: <span className="text-green-300">'...'</span> {'}'}
                    {'\n}'})
                  </code>
                </pre>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
