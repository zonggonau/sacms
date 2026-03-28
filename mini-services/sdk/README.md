# @sacms/sdk

TypeScript SDK for the SaCMS headless CMS.

## Installation

```bash
npm install @sacms/sdk
```

## Usage

```typescript
import { SaCMS } from "@sacms/sdk";

const cf = new SaCMS({
  baseUrl: "https://your-domain.com",
  tenant: "my-workspace",
  token: "cf_xxxxx",
  locale: "en", // optional default locale
});

// Query a collection
const articles = await cf.collection("articles").findMany({
  filters: { category: { $eq: "tutorial" } },
  fields: ["title", "slug", "author"],
  populate: ["author", "tags"],
  sort: "createdAt:desc",
  pagination: { page: 1, pageSize: 25 },
});

// Get single entry
const article = await cf.collection("articles").findOne("entry-id");

// Create entry (requires full-access token)
const created = await cf.collection("articles").create({
  data: { title: "New Article", body: "..." },
  locale: "en",
});

// Update entry
await cf.collection("articles").update("entry-id", {
  data: { title: "Updated Title" },
});

// Delete entry
await cf.collection("articles").delete("entry-id");

// Single types
const homepage = await cf.single("homepage").find({ locale: "id" });

// GraphQL
const result = await cf.graphql(`
  query {
    articles(locale: "en") {
      data { id title }
      meta { pagination { total } }
    }
  }
`);
```

## Error Handling

```typescript
import { SaCMSError } from "@sacms/sdk";

try {
  await cf.collection("articles").findMany();
} catch (err) {
  if (err instanceof SaCMSError) {
    console.error(`HTTP ${err.status}: ${err.message}`);
  }
}
```
