# i18n (ID / EN)

Two-locale UI localisation for SaCMS. **UI chrome only** — CMS content is
localised separately by the `locale` column on `ContentEntry` /
`TenantSingleTypeAssignment` and the `?locale=` query on the public API.

## How it works

- **Dictionary**: `dictionaries.ts` assembles `DICTIONARY: Record<Locale, Dict>`
  from the landing namespaces (defined inline) plus the per-domain files in
  `locales/`. `Dict` is the `id` tree run through `Widen<T>`, so the `en` side
  must have the same keys and shape — a mismatch is a **compile error**, not
  blank text in production. Different wording is fine.
- **Provider**: `context.tsx` — `<LanguageProvider initialLocale={...}>` is
  mounted in `providers.tsx`. Locale lives in a `locale` cookie (1yr,
  SameSite=Lax); the root `layout.tsx` reads it server-side, sets `<html lang>`,
  and passes `initialLocale` so the first paint matches (no hydration flash).
- **Hook**: `useI18n()` (alias `useLanguage()`) → `{ locale, setLocale, dict, t, fmt }`
  - `dict` — the typed dictionary for the active locale. Prefer this.
  - `t("path.to.key", fallback?)` — dynamic path lookup, for when the key isn't
    known statically (e.g. `t(\`errors.\${code}\`, res.error)`).
  - `fmt(template, { count, name })` — substitutes `{placeholder}` tokens.
- **Switcher**: `components/ui/language-switcher.tsx` — `<LanguageSwitcher/>`
  (compact dropdown) and `<MobileLanguageSwitcher/>` (full-width buttons).
  Mounted in the landing header and the workspace sidebar footer.

## Adding a namespace / localising a component

1. Create `locales/<name>.ts` exporting `{ id: {...}, en: {...} } as const`.
   The `id` side is the source of truth for the shape.
2. Register it in `dictionaries.ts`: add to the `Dict` type intersection and to
   both branches of `DICTIONARY`.
3. In the component: `const { dict } = useI18n()` then `dict.<name>.<key>`.
   Use `fmt()` for counts/names.
4. `__tests__/lib/i18n.test.ts` deep-checks that `id` and `en` stay in sync.

## Rollout status

| Area | Status |
|------|--------|
| Landing page | ✅ done (phase 1) |
| Member auth emails | ✅ done (phase 3, `email` namespace, server-side) |
| Workspace sidebar | ✅ done (phase 4a, `common.sidebar`) |
| Users & Permissions (Members + Roles) | ✅ done (phase 4b, `members` namespace) |
| Content manager / CMS studio | ⏳ pending — same pattern, new namespace |
| Workspace Settings | ⏳ pending |
| Platform Admin | ⏳ pending |

## SEO (phase 5)

The landing page uses the cookie switcher, not per-language URLs. `og:locale`
declares `id_ID` with `en_US` as `alternateLocale`. Distinct indexable URLs
(`/en/...` + `hreflang`) would need an `[locale]` route segment across the
landing route group + middleware — deferred until there's a demonstrated need
for separate search indexing.
