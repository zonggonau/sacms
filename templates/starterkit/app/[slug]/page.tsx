import { resolveContent } from "@/lib/sacms";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, User, Clock } from "lucide-react";
import Link from "next/link";
import { BlockRenderer } from "@/components/block-renderer";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function DynamicMasterPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await resolveContent(slug);

  if (!result) {
    return notFound();
  }

  const { type, data: rawData } = result;
  const data = rawData as any;

  // RENDER STRATEGY 1: Dynamic Page with Blocks (Components)
  if (type === "page") {
    return (
      <main className="min-h-screen bg-white">
        {/* If page has blocks, use BlockRenderer */}
        {data.blocks && data.blocks.length > 0 ? (
          <BlockRenderer blocks={data.blocks} />
        ) : (
          /* Fallback to standard page layout if no blocks */
          <div className="max-w-4xl mx-auto px-6 py-24">
            <h1 className="text-5xl font-extrabold mb-8">{data.title || slug.charAt(0).toUpperCase() + slug.slice(1)}</h1>
            <div className="prose prose-xl prose-slate max-w-none">
              {data.content ? (
                <div dangerouslySetInnerHTML={{ __html: data.content }} />
              ) : (
                <p className="text-gray-400 italic">No content or blocks available for this page.</p>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // RENDER STRATEGY 2: Blog Post Template
  if (type === "post") {
    return (
      <article className="min-h-screen bg-white pb-32">
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-12">
          <Link href="/" className="text-gray-400 hover:text-gray-900 mb-12 inline-flex items-center gap-2 font-bold text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-8 tracking-tight leading-tight">
            {data.title}
          </h1>
          <div className="flex items-center gap-6 pb-12 border-b border-gray-100">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-gray-900">{data.author?.name || "Team Member"}</div>
             </div>
             <div className="text-sm text-gray-400">{new Date(data.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {data.featuredImage && (
          <div className="max-w-6xl mx-auto px-6 mb-20">
            <div className="relative h-[500px] w-full rounded-[3rem] overflow-hidden shadow-2xl">
              <Image src={data.featuredImage.url} alt={data.title} fill className="object-cover" />
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 prose prose-xl prose-slate">
          <div dangerouslySetInnerHTML={{ __html: data.content || "" }} />
        </div>
      </article>
    );
  }

  return notFound();
}
