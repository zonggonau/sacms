import Link from "next/link";
import { sacms } from "@/lib/sacms";

export const revalidate = 60; // ISR cache for 60 seconds

export default async function HomePage() {
  // 1. Fetch site settings single type
  const siteSettings = await sacms.single("site_settings").find().catch(() => ({ data: { siteName: "SaCMS Demo Site", tagline: "Fast & Modern Headless CMS" } }));

  // 2. Fetch latest published articles with fluent query builder
  const { data: articles } = await sacms
    .collection("articles")
    .query()
    .select(["title", "slug", "summary", "createdAt"])
    .sort("createdAt:desc")
    .limit(6)
    .fetch()
    .catch(() => ({ data: [] }));

  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "24px", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "900", margin: 0 }}>{(siteSettings.data as any).siteName || "SaCMS Powered Site"}</h1>
        <p style={{ color: "#6b7280", marginTop: "8px" }}>{(siteSettings.data as any).tagline || "Built with @sacms/sdk and Next.js"}</p>
      </header>

      <section>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "20px" }}>Artikel Terbaru</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {articles.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>Belum ada artikel yang dipublikasikan.</p>
          ) : (
            articles.map((article: any) => (
              <div key={article.id} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>{article.title}</h3>
                <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: 1.5 }}>{article.summary || "Tidak ada ringkasan."}</p>
                <Link href={`/articles/${article.slug}`} style={{ display: "inline-block", marginTop: "12px", color: "#2563eb", fontWeight: "bold", fontSize: "13px" }}>
                  Baca Selengkapnya &rarr;
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
