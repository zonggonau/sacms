import { getLatestPosts, getHomepage, isConfigured, resolveContent } from "@/lib/sacms";
import { SetupRequired } from "@/components/setup-required";
import { BlockRenderer } from "@/components/block-renderer";
import Link from "next/link";
import { ArrowRight, Zap, Layout, Globe, Server } from "lucide-react";
import React from "react";

export default async function Home() {
  if (!isConfigured) {
    return <SetupRequired />;
  }

  // 1. Try to fetch dynamic Homepage single type
  const homepage = await getHomepage() as any;
  if (homepage?.blocks?.length > 0) {
    return <BlockRenderer blocks={homepage.blocks} />;
  }

  // 2. Try to fetch dynamic page content (slug: 'home') as legacy fallback
  const homeContent = await resolveContent("home") as any;
  if (homeContent?.type === "page" && homeContent.data.blocks?.length > 0) {
    return <BlockRenderer blocks={homeContent.data.blocks} />;
  }
  
  // 3. Fetch latest posts for the fallback/default view
  const posts = await getLatestPosts(6);

  // Fallback: Default Professional Landing Page
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
              Build Faster with <span className="text-blue-600">SaCMS</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-12">
              The ultimate Next.js frontend framework for headless CMS. 
              Manage your content effortlessly and deliver lightning-fast experiences.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/docs" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 group">
                Start Building <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="bg-white border border-gray-200 text-gray-900 px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all">
                View Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Features */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <FeatureItem icon={<Zap />} title="Real-time Updates" desc="Sync content instantly from SaCMS dashboard." />
            <FeatureItem icon={<Layout />} title="Flexible UI" desc="Fully compatible with Tailwind CSS & Shadcn." />
            <FeatureItem icon={<Globe />} title="Global Edge" desc="Deploy anywhere with Next.js edge runtime." />
            <FeatureItem icon={<Server />} title="Multi-tenant" desc="Built-in support for multiple environments." />
          </div>
        </div>
      </section>

      {/* Latest Content from SaCMS */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Latest Stories</h2>
              <p className="text-gray-600 text-lg">Manage this section by creating posts in SaCMS</p>
            </div>
            <Link href="/blog" className="hidden md:block text-blue-600 font-bold text-lg hover:underline decoration-2 underline-offset-4">
              Explore All &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posts.map((post: any) => (
              <Link 
                key={post.id} 
                href={`/${post.slug}`} 
                className="group bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Article</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h3>
                <p className="text-gray-500 leading-relaxed line-clamp-2">
                  {post.subtitle || "Read the full story to learn more about this topic."}
                </p>
                <div className="mt-8 flex items-center gap-2 text-sm font-bold text-gray-400 group-hover:text-gray-900 transition-colors">
                  Read More <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}

            {posts.length === 0 && (
              <div className="col-span-3 text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-gray-100">
                <p className="text-gray-400 text-lg">No content found in your SaCMS collection.</p>
                <p className="text-sm text-gray-300 mt-2">Start adding posts to see them here.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="space-y-4">
      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      </div>
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <p className="text-gray-500">{desc}</p>
    </div>
  );
}
