import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database", () => ({ getTenantDb: vi.fn() }))
const { authorizeActor } = vi.hoisted(() => ({ authorizeActor: vi.fn() }))
vi.mock("@/lib/public-api-actor", () => ({ authorizeActor }))

import { applyPopulate, resolvePopulate, populateTargetOf } from "@/lib/public-populate"

const publicActor = { kind: "public", tenantId: "t1", tenantSlug: "acme" } as never
const tokenActor = { kind: "api-token", accessLevel: "full-access", tenantId: "t1", tenantSlug: "acme", tokenId: "tok", isApiKey: false } as never

function fakeDb(): any {
  return {
    contentEntry: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where.contentType.slug === "authors") {
          return [{ id: "a1ccccccccccccc", data: JSON.stringify({ name: "Budi" }), status: "PUBLISHED" }]
        }
        return []
      }),
    },
    member: {
      findMany: vi.fn(async () => [{ id: "m1ccccccccccccc", name: "Sari", avatar: null }]),
    },
  }
}

const authorField = { slug: "author", relationSlug: "authors", options: { targetModel: "content-type" } }
const ownerField = { slug: "owner", relationSlug: null, options: { targetModel: "member" } }

beforeEach(() => {
  vi.clearAllMocks()
  authorizeActor.mockResolvedValue(null)
})

describe("populateTargetOf", () => {
  it("reads the target from the field", () => {
    expect(populateTargetOf(authorField)).toEqual({ kind: "entry", slug: "authors" })
    expect(populateTargetOf(ownerField)).toEqual({ kind: "member" })
    expect(populateTargetOf({ slug: "x", relationSlug: null, options: null })).toBeNull()
  })
})

describe("resolvePopulate", () => {
  it("does not expand a relation to a Content Type the caller cannot find", async () => {
    authorizeActor.mockResolvedValue({ status: 403, error: "denied" })
    const db = fakeDb()
    const r = await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: publicActor, fields: [authorField], rows: [{ author: "a1ccccccccccccc" }], publishedOnly: true })
    expect(r.expanded.has("author")).toBe(false)
    expect(db.contentEntry.findMany).not.toHaveBeenCalled()
  })

  it("expands an allowed relation, filtered to its own Content Type and to published entries for public callers", async () => {
    const db = fakeDb()
    const r = await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: publicActor, fields: [authorField], rows: [{ author: "a1ccccccccccccc" }], publishedOnly: true })
    expect(r.expanded.has("author")).toBe(true)
    const where = db.contentEntry.findMany.mock.calls[0][0].where
    expect(where.contentType).toEqual({ slug: "authors" })
    expect(where.status).toBe("PUBLISHED")
    expect(r.byId.get("a1ccccccccccccc")).toMatchObject({ id: "a1ccccccccccccc", name: "Budi" })
  })

  it("returns only public Member fields to a public caller", async () => {
    const db = fakeDb()
    await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: publicActor, fields: [ownerField], rows: [{ owner: "m1ccccccccccccc" }], publishedOnly: true })
    expect(db.member.findMany.mock.calls[0][0].select).toEqual({ id: true, name: true, avatar: true })
  })

  it("returns the fuller Member record to an API token, never the password hash", async () => {
    const db = fakeDb()
    await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: tokenActor, fields: [ownerField], rows: [{ owner: "m1ccccccccccccc" }], publishedOnly: false })
    const select = db.member.findMany.mock.calls[0][0].select
    expect(select).toMatchObject({ email: true, role: true, status: true })
    expect(select).not.toHaveProperty("passwordHash")
  })

  it("leaves an id that was not fetched as the raw id", async () => {
    const db = fakeDb()
    const r = await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: publicActor, fields: [authorField], rows: [{ author: "zzzzzzzzzzzzzzzzzzzz" }], publishedOnly: true })
    const out = applyPopulate({ author: "zzzzzzzzzzzzzzzzzzzz" }, r.expanded, r.byId)
    expect(out.author).toBe("zzzzzzzzzzzzzzzzzzzz")
  })

  it("expands each item of a to-many relation", async () => {
    const db = fakeDb()
    const r = await resolvePopulate({ tenantDb: db as never, tenantId: "t1", actor: publicActor, fields: [{ ...authorField, slug: "authors_many" }], rows: [{ authors_many: ["a1ccccccccccccc", "nope"] }], publishedOnly: true })
    const out = applyPopulate({ authors_many: ["a1ccccccccccccc", "nope"] }, r.expanded, r.byId)
    expect(out.authors_many).toEqual([expect.objectContaining({ id: "a1ccccccccccccc" }), "nope"])
  })
})
