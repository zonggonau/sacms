import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/ai", () => ({ safeGenerateContent: vi.fn() }))
vi.mock("@/lib/database", () => ({ getTenantDbById: vi.fn() }))
vi.mock("@/lib/content/entry-service", () => ({ resolveWritableContentType: vi.fn() }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { safeGenerateContent } from "@/lib/ai"
import { getTenantDbById } from "@/lib/database"
import { resolveWritableContentType } from "@/lib/content/entry-service"
import { aiFormContext, applyAiSuggestions, fieldAiActions, getFieldAiMode, isAiFieldEmpty, smartFillFields, type AiField } from "@/lib/content/field-ai"
import { POST as smartFill } from "@/app/api/tenant/[tenant]/ai/smart-fill/route"
import { POST as contentAssist } from "@/app/api/tenant/[tenant]/ai/content-assist/route"

const commodity = { kind: "contentType", slug: "commodities" } as const
const article = { kind: "contentType", slug: "article" } as const
const fields: AiField[] = [
  { slug: "name", name: "Nama Komoditas", type: "text" },
  { slug: "short-description", name: "Deskripsi Singkat", type: "textarea" },
  { slug: "description", name: "Deskripsi Lengkap", type: "richText" },
  { slug: "origin-location-description", name: "Keterangan Lokasi Asal", type: "text" },
  { slug: "seo", name: "SEO", type: "seo" },
  { slug: "price", name: "Harga", type: "currency" },
  { slug: "slug", name: "Slug", type: "slug" },
  { slug: "harvest-date", name: "Tanggal Panen", type: "date" },
  { slug: "organic", name: "Organik", type: "boolean" },
  { slug: "featured-image", name: "Gambar Utama", type: "media" },
  { slug: "gallery", name: "Galeri", type: "mediaMultiple" },
  { slug: "farmer", name: "Petani", type: "relation" },
  { slug: "category", name: "Kategori", type: "relation" },
]

function fixture(schema: AiField[]) {
  vi.mocked(resolveWritableContentType).mockResolvedValue({
    ok: true, data: { contentType: { name: "Komoditas" }, fields: schema },
  } as Awaited<ReturnType<typeof resolveWritableContentType>>)
}

function post(handler: typeof smartFill, body: object) {
  return handler(new Request("https://example.test/api/tenant/acme/ai", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Parameters<typeof handler>[0], { params: Promise.resolve({ tenant: "acme" }) })
}

describe("Aturan AI pada formulir CMS", () => {
  it("hanya mengizinkan field editorial Komoditas masuk ke Smart Fill", () => {
    expect(smartFillFields(fields, commodity).map((field) => field.slug)).toEqual(["short-description", "description", "seo"])
    expect(fieldAiActions(fields[0], commodity)).toEqual(["improve"])
    expect(fieldAiActions(fields[3], commodity)).toEqual(["improve"])
    expect(fieldAiActions(fields[4], commodity)).toEqual(["seo"])
    expect(isAiFieldEmpty("<p>&nbsp;</p>", fields[2])).toBe(true)
  })

  it("memakai mode Builder dan menolak nama field sensitif maupun faktual", () => {
    expect(getFieldAiMode({ type: "text", slug: "judul", name: "Judul" }, article)).toBe("write")
    expect(getFieldAiMode({ type: "text", slug: "caption", name: "Caption" }, article)).toBe("off")
    expect(getFieldAiMode({ type: "text", slug: "caption", name: "Caption", options: '{"aiAssist":"write"}' }, article)).toBe("write")
    expect(getFieldAiMode({ ...fields[2], options: { aiAssist: "off" } }, commodity)).toBe("off")
    for (const slug of ["accessToken", "harga", "sertifikasi", "tanggal-panen", "slug"]) {
      expect(getFieldAiMode({ type: "text", slug, name: slug, options: { aiAssist: "write" } }, article)).toBe("off")
    }
  })

  it("menjaga metadata SEO dan melewatkan harga serta field dengan kondisi yang belum terpenuhi", () => {
    const conditional = { slug: "notes", name: "Catatan", type: "textarea", options: { showIf: { targetFieldSlug: "organic", value: "true" } } }
    const data = { price: 40000, name: "Kakao", notes: "Catatan awal", organic: false, seo: { keywords: "kakao", og_image: "/kakao.webp" } }
    const seo = { meta_title: "Kakao", meta_description: "Informasi tentang kakao." }
    const schema = [...fields, conditional]
    expect(aiFormContext(schema, data, commodity)).toEqual({ name: "Kakao" })
    expect(applyAiSuggestions(schema, data, { seo, price: "1", notes: "Catatan AI" }, commodity)).toEqual({
      ...data, seo: { ...data.seo, ...seo },
    })
  })
})

describe("API AI untuk formulir CMS", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "editor", role: "editor" } } as never)
    vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "editor" } as never)
    vi.mocked(getTenantDbById).mockResolvedValue({} as never)
    fixture(fields)
  })

  it("memuat skema workspace dan membatasi konteks, hasil, dan biaya Smart Fill", async () => {
    vi.mocked(safeGenerateContent).mockResolvedValue({ text: JSON.stringify({
      description: "<p>Deskripsi kakao</p>",
      price: 1000,
      seo: { meta_title: "Kakao", meta_description: "Produk kakao.", og_image: "ignore" },
    }) } as never)
    const response = await post(smartFill, {
      form: commodity, fieldSlugs: ["description", "price", "seo"], context: { name: "Kakao", price: "40000" },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, content: {
      description: "<p>Deskripsi kakao</p>",
      seo: { meta_title: "Kakao", meta_description: "Produk kakao." },
    } })
    expect(getTenantDbById).toHaveBeenCalledWith("tenant-1")
    expect(resolveWritableContentType).toHaveBeenCalledWith({}, "commodities", { tenantId: "tenant-1" })
    const [, prompt, config] = vi.mocked(safeGenerateContent).mock.calls[0]
    expect(JSON.parse(prompt).source).toEqual({ "Nama Komoditas": "Kakao" })
    expect(config).toMatchObject({ creditsCost: 2, userId: "editor", refundOnFailure: true })
  })

  it("menolak perubahan yang tidak diizinkan sebelum memanggil AI", async () => {
    expect((await post(smartFill, { form: commodity, fieldSlugs: ["price", "name"], prompt: "Ubah harga" })).status).toBe(400)
    expect((await post(contentAssist, { form: commodity, fieldSlug: "name", action: "generate", prompt: "Buat nama" })).status).toBe(400)
    expect(safeGenerateContent).not.toHaveBeenCalled()
  })

  it("mengembalikan beberapa alternatif judul dan SEO terstruktur", async () => {
    fixture([...fields, { type: "text", slug: "title", name: "Judul" }])
    vi.mocked(safeGenerateContent).mockResolvedValueOnce({ text: '{"suggestions":["Panen Kakao","Cara Menyiapkan Kakao","Kakao untuk Pemula"]}' } as never)
    const titles = await post(contentAssist, { form: article, action: "generate", fieldSlug: "title", prompt: "Artikel tentang kakao" })
    expect(await titles.json()).toEqual({ success: true, suggestions: ["Panen Kakao", "Cara Menyiapkan Kakao", "Kakao untuk Pemula"] })
    vi.mocked(safeGenerateContent).mockResolvedValueOnce({ text: '{"meta_title":"Kakao","meta_description":"Artikel tentang kakao."}' } as never)
    const seo = await post(contentAssist, { form: article, action: "seo", fieldSlug: "seo", prompt: "Artikel tentang kakao" })
    expect(await seo.json()).toEqual({ success: true, suggestions: [{ meta_title: "Kakao", meta_description: "Artikel tentang kakao." }] })
  })

  it("mengikuti akses Single Type di CMS Studio", async () => {
    const form = { kind: "singleType", slug: "homepage" }
    const payload = { form, fieldSlugs: ["description"], prompt: "Selamat datang" }
    expect((await post(smartFill, payload)).status).toBe(404)
    expect(safeGenerateContent).not.toHaveBeenCalled()

    vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "admin" } as never)
    const findFirst = vi.fn().mockResolvedValue({ name: "Beranda", schemaFields: [fields[2]] })
    vi.mocked(getTenantDbById).mockResolvedValue({ singleType: { findFirst } } as never)
    vi.mocked(safeGenerateContent).mockResolvedValue({ text: '{"description":"<p>Selamat datang</p>"}' } as never)
    expect((await post(smartFill, payload)).status).toBe(200)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "homepage", showInCms: true, draftTemplateId: null }),
    }))
  })

  it("memakai mode yang dikonfigurasi pada field komponen", async () => {
    const caption = { type: "text", slug: "caption", name: "Caption", options: '{"aiAssist":"polish"}' }
    const findFirst = vi.fn().mockResolvedValue({ name: "Galeri", schemaFields: [caption] })
    vi.mocked(getTenantDbById).mockResolvedValue({ component: { findFirst } } as never)
    const payload = { form: { kind: "component", slug: "gallery-card" }, fieldSlug: "caption" }
    expect((await post(contentAssist, { ...payload, action: "generate", prompt: "Tulis caption" })).status).toBe(400)
    vi.mocked(safeGenerateContent).mockResolvedValue({ text: "Kakao lokal" } as never)
    const response = await post(contentAssist, { ...payload, action: "improve", content: "kakao lokal" })
    expect(await response.json()).toEqual({ success: true, suggestions: ["Kakao lokal"] })
  })

  it("melaporkan gangguan dan kuota tanpa mengembalikan saran buatan aplikasi", async () => {
    const payload = { form: commodity, fieldSlugs: ["description"], prompt: "Kakao" }
    vi.mocked(safeGenerateContent).mockRejectedValueOnce(new Error("Unavailable"))
    const failure = await post(smartFill, payload)
    expect(failure.status).toBe(503)
    expect(await failure.json()).not.toHaveProperty("content")
    vi.mocked(safeGenerateContent).mockRejectedValueOnce(Object.assign(new Error("Quota"), { status: 429 }))
    expect((await post(smartFill, payload)).status).toBe(429)
  })
})
