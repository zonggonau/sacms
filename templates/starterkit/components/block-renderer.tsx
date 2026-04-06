import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getLatestPosts } from "@/lib/sacms";

// --- Helpers ---
function getImageUrl(image: any) {
  if (!image) return null;
  let url = "";
  if (typeof image === 'string') {
    url = image;
  } else if (image.url) {
    url = image.url;
  }

  if (url && url.startsWith('/upload')) {
    const baseUrl = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
    return `${baseUrl}${url}`;
  }
  return url;
}

// --- Components (Blocks) ---

const Hero = ({ data }: any) => {
  const imageUrl = getImageUrl(data.image);
  return (
    <section className="relative py-24 md:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 leading-tight">
            {data.title}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
            {data.description}
          </p>
          <div className="flex gap-4">
            {data.ctaUrl && (
              <Link href={data.ctaUrl} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                {data.ctaLabel || "Get Started"}
              </Link>
            )}
          </div>
        </div>
        {imageUrl && (
          <div className="relative h-[500px] w-full rounded-[3rem] overflow-hidden shadow-2xl">
            <img src={imageUrl} alt={data.title} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
};

const Features = ({ data }: any) => (
  <section className="py-24 bg-slate-50">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">{data.title}</h2>
        <p className="text-gray-500 max-w-2xl mx-auto">{data.description}</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">{item.title}</h3>
            <p className="text-gray-500 text-sm">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const PostList = async ({ data }: any) => {
  const posts = await getLatestPosts(data.limit || 3);
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-end mb-16">
          <h2 className="text-4xl font-bold text-gray-900">{data.title || "Latest Stories"}</h2>
          <Link href="/blog" className="text-blue-600 font-bold hover:underline">View All</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post: any) => {
            const imageUrl = getImageUrl(post.featuredImage);
            return (
              <Link key={post.id} href={`/${post.slug}`} className="group space-y-4">
                <div className="relative h-60 w-full rounded-3xl overflow-hidden border border-slate-100">
                  {imageUrl && (
                    <img src={imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                <p className="text-gray-500 line-clamp-2">{post.subtitle}</p>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400 group-hover:text-gray-900">
                  Read More <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const RichText = ({ data }: any) => (
  <section className="py-16 max-w-4xl mx-auto px-6">
    <div className="prose prose-xl prose-slate max-w-none prose-img:rounded-3xl" dangerouslySetInnerHTML={{ __html: data.content }} />
  </section>
);

// --- Resolver Map ---

const BLOCK_COMPONENTS: any = {
  "hero": Hero,
  "features": Features,
  "post-list": PostList,
  "rich-text": RichText,
};

// --- Main Renderer ---

export function BlockRenderer({ blocks }: { blocks: any[] }) {
  if (!blocks || !Array.isArray(blocks)) return null;

  return (
    <>
      {blocks.map((block: any, index: number) => {
        if (!block?.__component) {
          console.warn(`Block at index ${index} is missing __component property`, block);
          return null;
        }

        const componentName = block.__component.includes('.') 
          ? block.__component.split(".")[1] 
          : block.__component;

        const Component = BLOCK_COMPONENTS[componentName];
        
        if (!Component) {
          console.warn(`No React component found for SaCMS component: ${block.__component}`);
          return null;
        }
        return <Component key={index} data={block} />;
      })}
    </>
  );
}
