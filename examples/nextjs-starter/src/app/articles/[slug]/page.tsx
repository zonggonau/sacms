import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getArticle, fieldText, mediaUrl } from "@/lib/content"
import { CONTENT } from "@/lib/config"
import { ErrorState } from "@/components/sacms/state"
import { RichText } from "@/components/sacms/rich-text"
import { MediaImage } from "@/components/sacms/media"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getArticle(slug)
  if (result.status !== "ok") return { title: "Artikel" }
  return { title: fieldText(result.data, CONTENT.articles.titleField) || "Artikel" }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getArticle(slug)

  // An error is not a missing page: show the message so the outage is visible.
  if (result.status === "error") return <ErrorState message={result.message} />
  if (result.status === "empty") notFound()

  const item = result.data
  const cover = mediaUrl(item[CONTENT.articles.coverField])
  const body = fieldText(item, CONTENT.articles.bodyField)

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{fieldText(item, CONTENT.articles.titleField)}</h1>
        {fieldText(item, CONTENT.articles.summaryField) && (
          <p className="text-lg text-muted-foreground">{fieldText(item, CONTENT.articles.summaryField)}</p>
        )}
      </header>
      {cover && <MediaImage url={cover} alt={fieldText(item, CONTENT.articles.titleField)} />}
      {body ? <RichText html={body} /> : <p className="text-muted-foreground">Isi artikel belum tersedia.</p>}
    </article>
  )
}
