import { notFound } from "next/navigation";
import Link from "next/link";
import { sacms } from "@/lib/sacms";

export async function generateStaticParams() {
  const { data: articles } = await sacms
    .collection("articles")
    .findMany({ fields: ["slug"] })
    .catch(() => ({ data: [] }));

  return articles.map((a: any) => ({ slug: a.slug }));
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: articles } = await sacms
    .collection("articles")
    .query()
    .where("slug", "eq", slug)
    .limit(1)
    .fetch()
    .catch(() => ({ data: [] }));

  if (!articles || articles.length === 0) {
    notFound();
  }

  const article = articles[0] as any;

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ color: "#2563eb", textDecoration: "none", fontSize: "14px", fontWeight: "bold" }}>
        &larr; Kembali ke Beranda
      </Link>
      
      <article style={{ marginTop: "24px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "900", lineHeight: 1.2 }}>{article.title}</h1>
        <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "8px" }}>
          Dipublikasikan: {new Date(article.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
        </p>

        <div
          style={{ marginTop: "32px", fontSize: "16px", lineHeight: 1.8, color: "#1f2937" }}
          dangerouslySetInnerHTML={{ __html: article.content || article.body || article.summary || "" }}
        />
      </article>
    </main>
  );
}
