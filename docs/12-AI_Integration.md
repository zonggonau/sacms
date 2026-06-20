# AI Integration Guide

**Status:** Implemented with feature-gating and external-provider dependency  
**Provider:** DeepSeek through the OpenAI-compatible SDK  
**Primary code:** `src/lib/ai.ts` and `src/app/api/tenant/[tenant]/ai/*`

## 1. Scope

SaCMS uses AI as an authoring assistant. Generated output is a draft suggestion and does not bypass schema validation, content workflow, reviewer approval, or publication permissions.

Available operations:

- Generate one text field.
- Smart-fill a form from its field schema.
- Generate and persist a Collection Type schema.
- Generate data for a Component.
- Generate data for a Single Type.
- Translate text while preserving Markdown/HTML formatting.
- Summarize long text.

## 2. Requirements and access control

All AI routes require:

1. `DEEPSEEK_API_KEY` configured on the server.
2. A valid NextAuth session.
3. Membership in the tenant from the URL.
4. `ENABLE_AI` for the workspace.

`ENABLE_AI` is active when either:

- An active subscription/add-on with plan slug `ai-gen` exists for the tenant, or
- The workspace plan is `enterprise` or `custom`.

Schema, Component, and Single Type generation additionally require workspace `owner` or `admin`. Text generation, Smart Fill, Translate, and Summarize are available to authorized tenant members after the feature gate passes.

> A Pro plan does not automatically enable AI in the current implementation; it requires the active `ai-gen` add-on.

## 3. Provider configuration

```env
DEEPSEEK_API_KEY="sk-..."
```

`src/lib/ai.ts` initializes the SDK lazily. Missing configuration is returned by guarded routes as HTTP `503`.

Model order:

1. `deepseek-chat`
2. `deepseek-reasoner`

Each model receives at most three attempts. HTTP 429 and 503 use exponential delays of approximately 2, 4, and 8 seconds. Other errors move directly to the next model.

## 4. Endpoint summary

Base path: `/api/tenant/{tenant}/ai`

| Method | Path | Input purpose | Access |
|---|---|---|---|
| `POST` | `/generate` | Generate one field | Tenant member + AI feature |
| `POST` | `/smart-fill` | Generate a JSON object matching a supplied schema | Tenant member + AI feature |
| `POST` | `/generate-schema` | Create a Collection Type and fields | Owner/admin + AI feature |
| `POST` | `/generate-component` | Generate Component data/schema | Owner/admin + AI feature |
| `POST` | `/generate-single-type` | Generate Single Type data/schema | Owner/admin + AI feature |
| `POST` | `/translate` | Translate text | Tenant member + AI feature |
| `POST` | `/summarize` | Summarize text | Tenant member + AI feature |

## 5. Generate one field

```http
POST /api/tenant/acme/ai/generate
Content-Type: application/json

{
  "prompt": "Tulis pembuka artikel tentang transportasi publik",
  "contentType": "articles",
  "fieldName": "content",
  "locale": "id",
  "tone": "professional",
  "maxTokens": 1000
}
```

Constraints:

- `prompt`: 1–2,000 characters.
- `maxTokens`: 50–4,096.
- `tone`: `formal`, `casual`, `professional`, `creative`, or `technical`.

Response:

```json
{
  "content": "Transportasi publik yang andal...",
  "usage": {
    "promptTokens": 48,
    "completionTokens": 190,
    "totalTokens": 238
  }
}
```

The route records an AI-generation audit event. Token usage is returned to the caller but is not yet a canonical persisted quota ledger.

## 6. Smart Fill

The Smart Fill route accepts the schema already loaded by the editor UI; it does not fetch the Content Type from a `contentTypeSlug` field.

```http
POST /api/tenant/acme/ai/smart-fill
Content-Type: application/json

{
  "prompt": "Berita peluncuran layanan bus listrik baru",
  "contentType": "Berita",
  "schema": [
    { "slug": "title", "type": "text", "required": true },
    { "slug": "summary", "type": "textarea", "required": true },
    { "slug": "content", "type": "richText", "required": true }
  ]
}
```

Response:

```json
{
  "content": {
    "title": "Layanan Bus Listrik Baru Resmi Diluncurkan",
    "summary": "Armada baru memperluas akses transportasi rendah emisi.",
    "content": "<p>Pemerintah kota hari ini...</p>"
  }
}
```

The server requests `json_object` output, removes an optional Markdown code fence, parses JSON, and returns HTTP 500 when the provider still produces invalid JSON.

## 7. Generate Collection Type schema

This route creates the Collection Type immediately; it is not a preview-only operation.

```http
POST /api/tenant/acme/ai/generate-schema
Content-Type: application/json

{
  "prompt": "Buat skema produk dengan nama, slug, harga, stok, gambar, dan kategori"
}
```

Behavior:

1. AI returns a JSON schema.
2. If the slug already exists for the tenant, a random suffix is appended.
3. The Collection Type is created with `isPublished: true`.
4. Generated fields are persisted as `SchemaField` records.
5. A tenant assignment is created.

The response is the created Content Type object with `schemaFields`, not a wrapper named `schema`.

## 8. Translate

```http
POST /api/tenant/acme/ai/translate
Content-Type: application/json

{
  "text": "## Selamat datang\n\nKonten **penting**.",
  "targetLocale": "en",
  "sourceLocale": "id"
}
```

Limits: text up to 10,000 characters; locale codes 2–10 characters. The response uses the same `{ content, usage }` shape as `/generate`.

## 9. Summarize

```http
POST /api/tenant/acme/ai/summarize
Content-Type: application/json

{
  "text": "Teks panjang...",
  "maxLength": 200,
  "locale": "id"
}
```

Limits: text up to 10,000 characters; `maxLength` 50–1,000. The requested length is a prompt instruction and should not be treated as a hard character guarantee; clients may trim or validate the final text if a strict field limit applies.

## 10. Dashboard workflow

1. Open a Collection entry create/edit screen.
2. Use Smart Fill to propose values for multiple fields.
3. Review every generated value, especially relations, media URLs, HTML, facts, and locale-sensitive wording.
4. Save as `DRAFT` first when human review is required.
5. Submit through the normal approval workflow.

AI never performs the final workflow transition implicitly.

## 11. Security and privacy

- Do not send credentials, tokens, private keys, health data, or unnecessary personal data in prompts.
- Prompt text is sent to the external AI provider.
- Provider output must be treated as untrusted input and validated before persistence/rendering.
- Rich text should pass the same sanitization policy as manually authored rich text.
- Generated relation identifiers and media URLs may be fictional and require human correction.
- Error logs must not include complete sensitive prompts.

## 12. Known boundaries

- There is no persisted, authoritative per-tenant AI quota ledger yet.
- Smart Fill depends on the client-supplied schema.
- Schema generation writes immediately and should be used only by owner/admin.
- Retry delays can make a request noticeably long during provider throttling.
- The fallback model may produce output with different style or structure.

## 13. Troubleshooting

| HTTP/status | Likely cause | Action |
|---|---|---|
| `503` | Missing `DEEPSEEK_API_KEY` | Configure the key and restart/redeploy |
| `403` | AI feature/add-on inactive | Activate `ai-gen` or use Enterprise/Custom |
| `403` on schema generation | Member is not owner/admin | Use an authorized account |
| `400` | Payload validation failed | Match the documented field names and limits |
| `429` | Provider quota/rate limit | Wait and retry after the provider window |
| `500` invalid JSON | Model did not return parseable JSON | Simplify prompt and retry |

