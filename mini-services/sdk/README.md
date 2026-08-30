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
const created = await sacms.collection("posts").create({
  data: {
    title: "How We Scaled Next.js to 1M Users",
    slug: "scaling-nextjs",
    content: "<p>Deep dive into architecture...</p>",
  },
  locale: "id",
  status: "PUBLISHED",
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

Generate strict TypeScript definitions reflecting your live CMS schemas:

```bash
# Run CLI
npx @sacms/sdk generate \
  --url https://your-sacms-instance.com \
  --tenant my-tenant \
  --token cf_live_xxxx \
  --out src/types/sacms.d.ts
```

Then enjoy full intellisense:

```typescript
import type { Article } from "./types/sacms";

const { data } = await sacms.collection<Article>("articles").findMany();
// data[0].title -> string
// data[0].slug  -> string
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
    console.error(`SaCMS API Error [HTTP ${error.status}]: ${error.message}`);
  } else {
    console.error("Network or unexpected error:", error);
  }
}
```

---

## 📄 License
MIT © [SaCMS Team](https://sacms.cloud)
