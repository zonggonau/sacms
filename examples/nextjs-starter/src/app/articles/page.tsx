import Link from "next/link"
import type { Metadata } from "next"
import { listArticles, fieldText, mediaUrl, type Item } from "@/lib/content"
import { CONTENT } from "@/lib/config"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState } from "@/components/sacms/state"
import { MediaImage } from "@/components/sacms/media"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Artikel" }

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1)
  const result = await listArticles(page)

  if (result.status === "error") return <ErrorState message={result.message} />
  if (result.status === "empty") {
    return <EmptyState title="Belum ada artikel" description={`Tambahkan entri di koleksi "${CONTENT.articles.collection}".`} />
  }

  const { items, totalPages } = result.data
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Artikel</h1>
      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((item, i) => (
          <ArticleCard key={String(item._id ?? i)} item={item} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} />
    </div>
  )
}

function ArticleCard({ item }: { item: Item }) {
  const slug = fieldText(item, CONTENT.articles.slugField)
  const cover = mediaUrl(item[CONTENT.articles.coverField])
  return (
    <Card className="overflow-hidden">
      {cover && <MediaImage url={cover} alt={fieldText(item, CONTENT.articles.titleField)} className="aspect-video" />}
      <CardHeader>
        <CardTitle>
          <Link href={`/articles/${slug}`} className="hover:underline">
            {fieldText(item, CONTENT.articles.titleField) || "Tanpa judul"}
          </Link>
        </CardTitle>
        {fieldText(item, CONTENT.articles.summaryField) && (
          <CardDescription>{fieldText(item, CONTENT.articles.summaryField)}</CardDescription>
        )}
      </CardHeader>
    </Card>
  )
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <Button variant="outline" size="sm" asChild disabled={page <= 1}>
        <Link href={`/articles?page=${page - 1}`} aria-disabled={page <= 1}>Sebelumnya</Link>
      </Button>
      <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
      <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
        <Link href={`/articles?page=${page + 1}`} aria-disabled={page >= totalPages}>Berikutnya</Link>
      </Button>
    </div>
  )
}
