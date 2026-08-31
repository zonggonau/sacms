---
name: manage-content
description: Query, insert, update, filter, and publish content entries in SaCMS collections using MCP tools.
---

# Manage Content Skill for SaCMS

Use this skill whenever the user wants to search, read, create, update, or publish content records in their SaCMS workspace.

## 🛠️ Relevant MCP Tools:
- `list_entries`: Query records with Strapi-style filtering, full-text search, pagination, and relation population.
- `get_entry`: Fetch a single entry by ID with populated relations.
- `create_entry`: Add a new entry with status `DRAFT` or `PUBLISHED`.
- `update_entry`: Update existing entry fields and workflow status.
- `delete_entry`: Remove an entry from the database.
- `bulk_create_entries`: Import multiple records in a single batch.
- `bulk_delete_entries`: Delete multiple records by ID list.

## 🔍 Strapi-Style Filtering Reference:
When using `list_entries`, pass filters in the `filters` parameter:
```json
{
  "price": { "$gte": 50000 },
  "category": { "$eq": "electronics" },
  "title": { "$contains": "MacBook" }
}
```

Supported filter operators:
- `$eq`, `$ne`: Exact match / Not equal
- `$lt`, `$lte`, `$gt`, `$gte`: Comparison
- `$contains`, `$notContains`: Case-insensitive text search
- `$in`, `$notIn`: Match against array of values
- `$null`, `$notNull`: Check field existence

## 🌐 Localization (i18n):
Provide the `locale` parameter (e.g. `"id"`, `"en"`) when querying or saving multilingual entries.
