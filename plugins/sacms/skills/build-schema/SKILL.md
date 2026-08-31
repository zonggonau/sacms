---
name: build-schema
description: Design, scaffold, and manage Content Types, Single Types, and Reusable Components using SaCMS 33 field types.
---

# Build Schema Skill for SaCMS

Use this skill when the user wants to create a new content model, define singleton pages (like Homepage, Site Settings), or assemble reusable component blocks.

## 🛠️ Relevant MCP Tools:
- `list_field_types`: **Always call this first** to discover all 33 official field types, options, and JSON validation schemas.
- `get_full_schema`: Inspect the entire workspace architecture (all collections, single types, and components).
- `list_content_types` / `get_content_type`: View active collections and their field schemas.
- `create_content_type`: Define a new collection model with fields.
- `update_content_type`: Add or modify fields on an existing model.
- `delete_content_type`: Delete a collection and its schema.
- `create_single_type` / `get_single_type` / `update_single_type`: Manage singleton pages.
- `create_component` / `list_components`: Manage reusable schema building blocks.

## 🏷️ SaCMS 33 Supported Field Types:
1. **Basic:** `text`, `textarea`, `richText`, `markdown`, `slug`
2. **Number:** `number`, `currency` (IDR/USD), `percent` (0-100%)
3. **Date & Time:** `date`, `datetime`, `time`, `dateRange`
4. **Selection:** `select`, `multiselect`, `tags`, `icon`
5. **Boolean:** `boolean`
6. **Validation:** `email`, `password`, `url`, `phone`, `uid`
7. **Media:** `media`, `mediaMultiple`, `file`
8. **Relations:** `relation`, `component`, `repeater` (dynamic zones)
9. **Advanced:** `location` (lat/lng), `seo`, `code`, `json`, `color`, `rating`, `button`, `document_template`

## 💡 Best Practice Workflow:
1. Call `list_field_types` to inspect the exact configuration for the fields you want to add.
2. Call `create_content_type` with a lowercase slug and array of field definitions.
3. Call `create_entry` to populate initial test data.
