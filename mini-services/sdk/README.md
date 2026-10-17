# @sacms/sdk

The official TypeScript SDK for **SaCMS** (SaaS Headless CMS). Connect any frontend application (Next.js, Vite, Astro, Nuxt, SvelteKit, or mobile apps) to your multi-tenant SaCMS workspaces with end-to-end type safety, auto-retries, fluent query building, and native GraphQL support.

---

## 🚀 Installation

Install via npm, bun, pnpm, or yarn:

```bash
npm install @sacms/sdk
# or
bun add @sacms/sdk
# or
pnpm add @sacms/sdk
```

---

## ⚡ Quick Start

```typescript
import { SaCMS } from "@sacms/sdk";

// Initialize the client
const sacms = new SaCMS({
  baseUrl: "https://your-sacms-instance.com", // or http://localhost:3000
  tenant: "agency-client-1",                   // Workspace slug or ID
  token: "cf_live_xxxxxxxxxxxx",               // Read-only or Full-Access API Token
  locale: "id",                                // Default locale (e.g. 'id', 'en')
});

// Fetch published articles
const articles = await sacms.collection("articles").findMany({
  filters: { category: { $eq: "technology" } },
  sort: "createdAt:desc",
  pagination: { page: 1, pageSize: 10 },
});

console.log(articles.data);
```

---

## 🧩 Fluent Query Builder

Enjoy a chainable, type-safe query syntax:

```typescript
const result = await sacms
  .collection("articles")
  .query()
  .where("category", "eq", "engineering")
  .where("viewCount", "gte", 100)
  .select(["title", "slug", "coverImage", "summary", "createdAt"])
  .populate(["author", "tags"])
  .sort("publishedAt:desc")
  .search("microservices")
  .locale("id")
  .status("PUBLISHED")
  .page(1)
  .limit(20)
  .fetch();

console.log(result.data);       // Typed array of entries
console.log(result.meta);       // Total count, page, and pagination info
```

---

## 📦 Core Features

### 1. Collections CRUD

```typescript
// 1. Query multiple entries
const posts = await sacms.collection("posts").findMany({
  filters: { status: { $eq: "PUBLISHED" } },
  fields: ["title", "slug", "content"],
  populate: ["author"],
});

// 2. Fetch single entry by ID
const post = await sacms.collection("posts").findOne("entry_cuid_123");

// 3. Create entry (Requires Full-Access API Token)
// New entries created through the public API are always saved as DRAFT —
// the `status` param is accepted for forward-compatibility but has no
// effect on create today; publishing goes through the CMS's own review
// workflow (the dashboard, or an authenticated staff action), not this API.
const created = await sacms.collection("posts").create({
  data: {
    title: "How We Scaled Next.js to 1M Users",
    slug: "scaling-nextjs",
    content: "<p>Deep dive into architecture...</p>",
  },
  locale: "id",
});

// 4. Update entry
const updated = await sacms.collection("posts").update("entry_cuid_123", {
  data: { title: "Updated Title" },
});

// 5. Delete entry
await sacms.collection("posts").delete("entry_cuid_123");
```

### 2. Single Types (Global Settings, Landing, Header, Footer)

```typescript
// Fetch single type data
const siteSettings = await sacms.single("site_settings").find({ locale: "id" });
console.log(siteSettings.data.siteName);
console.log(siteSettings.data.logoUrl);

// Update single type (Requires Full-Access API Token)
await sacms.single("site_settings").update({
  siteName: "SaCMS Cloud Portal",
  announcementText: "Version 2.0 Released!",
});
```

### 3. GraphQL Query & Mutations

```typescript
const { data, errors } = await sacms.graphql(`
  query GetFeaturedArticles($limit: Int) {
    articles(limit: $limit, published: true, sort: "createdAt", order: "desc") {
      data {
        id
        title
        slug
        publishedAt
      }
      meta {
        total
      }
    }
  }
`, { limit: 5 });
```

---

## 🔮 Automated Type Generation CLI

Generate strict TypeScript definitions from your **real, live** schema — the CLI introspects your actual GraphQL schema over the network (no local database access needed, works against any SaCMS instance your token can reach):

```bash
npx @sacms/sdk generate \
  --url https://your-sacms-instance.com \
  --tenant my-tenant \
  --token cf_live_xxxx \
  --out src/types/sacms.ts
```

This writes one interface per Content Type / Single Type, plus a `SaCMSRegistry`-shaped type (named `SaCMSRegistry` in the file, but you can import it under whatever name you like). Pass it to `SaCMS` as a type argument for full, automatic per-slug intellisense — no `<Article>` on every call:

```typescript
import { SaCMS } from "@sacms/sdk";
import type { SaCMSRegistry } from "./types/sacms";

const sacms = new SaCMS<SaCMSRegistry>({ baseUrl, tenant, token });

const { data } = await sacms.collection("articles").findMany();
// data[0].title -> string, inferred from your real "articles" Content Type — no explicit <Article> needed
```

Without a registry type argument, `SaCMS` is untyped by default (every `collection()`/`single()` call accepts any slug and returns `Record<string, unknown>`, or an explicit generic you pass per call) — there is no tenant-specific schema baked into the package itself.

---

## 👤 Member Authentication

For apps with end-user accounts (a SaaS dashboard, a forum, a marketplace — anything where *visitors*, not just your backend, sign in), use `sacms.auth`. This is separate from the `token` you configured `SaCMS` with: that's your workspace's own service credential, used for every other method above. Member auth is stateless — the SDK doesn't store sessions for you; keep the tokens `login`/`register`/`refresh` return wherever your app keeps its own session state (a cookie, usually), and pass the current one back in on each authenticated call.

```typescript
// Sign up / sign in
const session = await sacms.auth.register({ email, password, name });
// or: const session = await sacms.auth.login(email, password);
if ("requiresEmailVerification" in session) {
  // registration succeeded but needs email confirmation before a session is issued
} else {
  // session.user, session.accessToken, session.refreshToken, session.expiresIn
}

// Authenticated calls use that member's own accessToken, not your service token
const { user } = await sacms.auth.me(session.accessToken);
await sacms.auth.updateMe(session.accessToken, { name: "New Name" });
await sacms.auth.changePassword(session.accessToken, { currentPassword, password, passwordConfirmation });

// Refresh when the access token expires (rotates the refresh token too)
const refreshed = await sacms.auth.refresh(session.refreshToken);

// Sign out (revokes the refresh token server-side)
await sacms.auth.logout(session.refreshToken);

// Forgot/reset password, and consuming an email-verification link
await sacms.auth.forgotPassword(email);
await sacms.auth.resetPassword({ code, password, passwordConfirmation });
await sacms.auth.confirmEmail(code);
```

---

## 🛠️ Framework Integration Recipes

### Next.js 15/16 App Router (Server Component)

```typescript
// app/blog/page.tsx
import { SaCMS } from "@sacms/sdk";

const sacms = new SaCMS({
  baseUrl: process.env.SACMS_BASE_URL!,
  tenant: process.env.SACMS_TENANT!,
  token: process.env.SACMS_API_TOKEN!,
});

export default async function BlogPage() {
  const { data: posts } = await sacms.collection("articles").findMany({
    sort: "createdAt:desc",
    pagination: { pageSize: 12 },
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      {posts.map((post: any) => (
        <article key={post.id} className="border p-4 rounded-xl">
          <h2 className="font-bold text-lg">{post.title}</h2>
          <p className="text-gray-600">{post.summary}</p>
        </article>
      ))}
    </div>
  );
}
```

### Astro (SSG & Dynamic Static Paths)

```astro
---
// src/pages/blog/[slug].astro
import { SaCMS } from "@sacms/sdk";

export async function getStaticPaths() {
  const sacms = new SaCMS({
    baseUrl: import.meta.env.SACMS_BASE_URL,
    tenant: import.meta.env.SACMS_TENANT,
    token: import.meta.env.SACMS_API_TOKEN,
  });

  const { data: articles } = await sacms.collection("articles").findMany();

  return articles.map((article: any) => ({
    params: { slug: article.slug },
    props: { article },
  }));
}

const { article } = Astro.props;
---

<main class="max-w-3xl mx-auto py-12">
  <h1 class="text-3xl font-bold">{article.title}</h1>
  <div class="prose mt-6" set:html={article.content} />
</main>
```

---

## 🛡️ Error Handling

```typescript
import { SaCMS, SaCMSError } from "@sacms/sdk";

try {
  const result = await sacms.collection("articles").findOne("invalid-id");
} catch (error) {
  if (error instanceof SaCMSError) {
    // error.status is the real HTTP status for an API-level error (404, 403, …),
    // or 0 if every retry hit a pure network failure (DNS, connection reset, timeout) —
    // those are retried with backoff first, same as a 429, before being thrown.
    console.error(`SaCMS API Error [HTTP ${error.status}]: ${error.message}`);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

---

## 📄 License
MIT © [SaCMS Team](https://sacms.cloud)
