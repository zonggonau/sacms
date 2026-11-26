import { SaCMSError } from "@sacms/sdk"
import { getSacms } from "@/lib/sacms"
import { CONTENT, PAGE_SIZE } from "@/lib/config"

// Every read returns one of three outcomes. Pages must render each one
// differently: "empty" is a real answer (nothing published yet), "error" means
// the request did not work. Treating an error as empty hides outages.
export type ContentResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "error"; message: string }

export type Item = Record<string, unknown>

function toErrorResult(err: unknown): { status: "error"; message: string } {
  if (err instanceof SaCMSError) {
    return { status: "error", message: `SaCMS mengembalikan ${err.status}: ${err.message}` }
  }
  if (err instanceof Error && err.name === "AbortError") {
    return { status: "error", message: "Permintaan ke SaCMS melewati batas waktu." }
  }
  return { status: "error", message: "Tidak bisa terhubung ke SaCMS." }
}

function configError<T>(missing: string[]): ContentResult<T> {
  return { status: "error", message: `Konfigurasi belum lengkap: ${missing.join(", ")} (lihat .env.example).` }
}

export async function listArticles(page = 1): Promise<ContentResult<{ items: Item[]; totalPages: number }>> {
  const setup = getSacms()
  if (!setup.ok) return configError(setup.missing)

  try {
    const res = await setup.client
      .collection(CONTENT.articles.collection)
      .query()
      .sort("createdAt:desc")
      .page(page)
      .limit(PAGE_SIZE)
      .fetch()

    if (!res.data || res.data.length === 0) return { status: "empty" }
    return { status: "ok", data: { items: res.data as Item[], totalPages: res.meta.pagination.totalPages } }
  } catch (err) {
    return toErrorResult(err)
  }
}

export async function getArticle(slug: string): Promise<ContentResult<Item>> {
  const setup = getSacms()
  if (!setup.ok) return configError(setup.missing)

  try {
    const res = await setup.client
      .collection(CONTENT.articles.collection)
      .query()
      .where(CONTENT.articles.slugField, "$eq", slug)
      .limit(1)
      .fetch()

    const item = res.data?.[0] as Item | undefined
    if (!item) return { status: "empty" }
    return { status: "ok", data: item }
  } catch (err) {
    return toErrorResult(err)
  }
}

export async function getHomepage(): Promise<ContentResult<Item>> {
  const setup = getSacms()
  if (!setup.ok) return configError(setup.missing)

  try {
    const res = await setup.client.single(CONTENT.homepage.single).find()
    const data = res.data as Item | null | undefined
    if (!data || Object.keys(data).length === 0) return { status: "empty" }
    return { status: "ok", data }
  } catch (err) {
    // A Single Type that was never created answers 404. That is "nothing yet",
    // not an outage.
    if (err instanceof SaCMSError && err.status === 404) return { status: "empty" }
    return toErrorResult(err)
  }
}

export function fieldText(item: Item, field: string): string {
  const value = item[field]
  return typeof value === "string" ? value : ""
}

// Media fields can come back as a plain URL or as an object that has one.
export function mediaUrl(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url
    if (typeof url === "string" && url.length > 0) return url
  }
  return null
}
