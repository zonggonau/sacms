import Link from "next/link"
import { getHomepage, fieldText } from "@/lib/content"
import { CONTENT } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState } from "@/components/sacms/state"
import { Markdown } from "@/components/sacms/markdown"

// Content is read on every request so a published change shows up at once.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const result = await getHomepage()

  return (
    <div className="space-y-8">
      {result.status === "ok" && (
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            {fieldText(result.data, CONTENT.homepage.headlineField) || "Selamat datang"}
          </h1>
          {fieldText(result.data, CONTENT.homepage.introField) && (
            <Markdown source={fieldText(result.data, CONTENT.homepage.introField)} className="text-lg text-muted-foreground" />
          )}
        </section>
      )}

      {result.status === "empty" && (
        <EmptyState
          title="Halaman beranda belum diisi"
          description={`Buat Single Type "${CONTENT.homepage.single}" di SaCMS lalu isi dan publikasikan.`}
        />
      )}

      {result.status === "error" && <ErrorState message={result.message} />}

      <div>
        <Button asChild>
          <Link href="/articles">Lihat artikel</Link>
        </Button>
      </div>
    </div>
  )
}
