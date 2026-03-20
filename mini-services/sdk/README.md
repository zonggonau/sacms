# @contentflow/sdk

TypeScript SDK for the ContentFlow headless CMS.

## Installation

```bash
npm install @contentflow/sdk
```

## Usage

```typescript
import { ContentFlow } from "@contentflow/sdk";

const cf = new ContentFlow({
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
import { ContentFlowError } from "@contentflow/sdk";

try {
  await cf.collection("articles").findMany();
} catch (err) {
  if (err instanceof ContentFlowError) {
    console.error(`HTTP ${err.status}: ${err.message}`);
  }
}
```
