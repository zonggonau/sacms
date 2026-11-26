// The names this starter expects in your SaCMS schema. Change them here, in
// one place, if your Content Types or fields are named differently.
//
// Recommended schema:
//   Collection  "articles"  fields: title (text), slug (slug), summary (textarea),
//                           body (richText), cover (media)
//   Single Type "homepage"  fields: headline (text), intro (markdown)
//
// Every page still renders when a name is missing: the page shows the empty
// state, or the error state with the exact SaCMS message, instead of crashing.

export const CONTENT = {
  articles: {
    collection: "articles",
    titleField: "title",
    slugField: "slug",
    summaryField: "summary",
    bodyField: "body",
    coverField: "cover",
  },
  homepage: {
    single: "homepage",
    headlineField: "headline",
    introField: "intro",
  },
} as const

export const PAGE_SIZE = 12
