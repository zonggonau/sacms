import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/lib/database"
import { buildFilterSQL, parseFilters } from "@/lib/filters"

function ciDatabase(raw: string | undefined, database: string) {
  if (!raw || process.env.SACMS_WORKFLOW_CI !== "1") throw new Error("Run with the disposable CI databases.")
  const parsed = new URL(raw)
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== `/${database}`) {
    throw new Error("Integration test databases must match the disposable loopback configuration.")
  }
}

ciDatabase(process.env.DATABASE_URL, "sacms_workflow_ci")

const allowed = new Set(["title", "category", "status", "price"])
let contentTypeId = ""

beforeAll(async () => {
  const tenant = await db.tenant.create({ data: { name: "Filters CI", slug: "filters-ci" } })
  const model = await db.contentType.create({ data: { tenantId: tenant.id, name: "Posts", slug: "posts" } })
  contentTypeId = model.id
  const rows = [
    { title: "Next.js Guide", category: "tutorial", status: "featured", price: 100 },
    { title: "Belajar Prisma", category: "tutorial", status: "draft", price: 600 },
    { title: "Diskon 50% Hari Ini", category: "promo", status: "featured", price: 50 },
    { title: "Berita_Nabire", category: "news", status: "archived", price: 0 },
  ]
  for (const data of rows) {
    await db.contentEntry.create({ data: { tenantId: tenant.id, contentTypeId, data, status: "PUBLISHED" } })
  }
})

afterAll(async () => {
  await db.$disconnect()
})

// Runs the exact fragments the public content routes append to their WHERE clause.
async function titlesFor(query: string): Promise<string[]> {
  const { conditions, orGroups, rejected } = parseFilters(new URLSearchParams(query), allowed)
  expect(rejected).toEqual([])
  const { fragments, params } = buildFilterSQL(conditions, orGroups, 2)
  const where = [`"contentTypeId" = $1`, ...fragments].join(" AND ")
  const rows = await db.$queryRawUnsafe<{ title: string }[]>(
    `SELECT "data"->>'title' AS title FROM "content_entries" WHERE ${where}`,
    contentTypeId,
    ...params,
  )
  return rows.map((r) => r.title).sort()
}

describe("public API filters against PostgreSQL", () => {
  it("$containsi matches regardless of case", async () => {
    expect(await titlesFor("filters[title][$containsi]=NEXT")).toEqual(["Next.js Guide"])
  })

  it("$containsi returns zero rows for a substring nobody has", async () => {
    expect(await titlesFor("filters[title][$containsi]=zzz")).toEqual([])
  })

  it("$containsi treats '%' and '_' literally instead of as wildcards", async () => {
    expect(await titlesFor("filters[title][$containsi]=%25")).toEqual(["Diskon 50% Hari Ini"])
    expect(await titlesFor("filters[title][$containsi]=_")).toEqual(["Berita_Nabire"])
  })

  it("$or returns the union of its alternatives", async () => {
    expect(
      await titlesFor("filters[$or][0][category][$eq]=promo&filters[$or][1][category][$eq]=news"),
    ).toEqual(["Berita_Nabire", "Diskon 50% Hari Ini"])
  })

  it("$or returns zero rows when no alternative matches", async () => {
    expect(
      await titlesFor("filters[$or][0][category][$eq]=nope&filters[$or][1][category][$eq]=none"),
    ).toEqual([])
  })

  it("$or ANDs conditions that share an index", async () => {
    const query =
      "filters[$or][0][category][$eq]=tutorial&filters[$or][0][price][$gt]=500&filters[$or][1][status][$eq]=archived"
    expect(await titlesFor(query)).toEqual(["Belajar Prisma", "Berita_Nabire"])
  })

  it("a top-level filter still narrows an $or group", async () => {
    const query =
      "filters[status][$eq]=featured&filters[$or][0][category][$eq]=tutorial&filters[$or][1][category][$eq]=promo"
    expect(await titlesFor(query)).toEqual(["Diskon 50% Hari Ini", "Next.js Guide"])
  })

  it("$or alternatives can use $containsi", async () => {
    expect(
      await titlesFor("filters[$or][0][title][$containsi]=prisma&filters[$or][1][title][$containsi]=NABIRE"),
    ).toEqual(["Belajar Prisma", "Berita_Nabire"])
  })
})
