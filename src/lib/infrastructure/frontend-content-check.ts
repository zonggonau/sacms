/**
 * Static checks on a website's source against the workspace's content API use.
 * Pure: it reads file text and the schema's slugs and returns warnings. Nothing
 * here blocks a deploy; a heuristic should not stop a site from going live.
 *
 * Catches the failures that build cleanly but show wrong content:
 * - a slug the code fetches that the schema does not have (a Content Type
 *   renamed or a template written for a different schema)
 * - a fetch whose HTTP status is never checked, so an API failure looks like
 *   an empty collection
 * - a site that reads content but has no revalidation hook, so edits may not
 *   show until the cache expires
 */

export interface CheckFile {
  name: string
  content: string
}

export interface SchemaSlugs {
  contentTypes: string[]
  singleTypes: string[]
}

export type FrontendWarningCode =
  | "UNKNOWN_CONTENT_TYPE"
  | "UNKNOWN_SINGLE_TYPE"
  | "HTTP_STATUS_UNCHECKED"
  | "NO_REVALIDATION"

export interface FrontendWarning {
  code: FrontendWarningCode
  file: string
  line?: number
  message: string
}

const SOURCE_FILE = /\.(tsx?|jsx?|mjs|cjs|mdx?|vue|svelte|html)$/i
const CONTENT_URL = /\/api\/public\/[^/\s'"`]+\/content\/([A-Za-z0-9_-]+)/
const SINGLE_URL = /\/api\/public\/[^/\s'"`]+\/single\/([A-Za-z0-9_-]+)/
const STATUS_CHECK = /\.ok\b|\.status\b/
const REVALIDATE = /revalidate(Tag|Path)?\s*\(|\/api\/revalidate/

export function checkFrontendSource(files: CheckFile[], schema: SchemaSlugs): FrontendWarning[] {
  const warnings: FrontendWarning[] = []
  const contentTypes = new Set(schema.contentTypes)
  const singleTypes = new Set(schema.singleTypes)
  const sources = files.filter((f) => SOURCE_FILE.test(f.name))
  let readsContent = false

  for (const file of sources) {
    const lines = file.content.split(/\r?\n/)
    let fileReadsApi = false

    lines.forEach((line, i) => {
      const content = line.match(CONTENT_URL)
      if (content) {
        fileReadsApi = true
        readsContent = true
        const slug = content[1]
        if (!contentTypes.has(slug)) {
          warnings.push({
            code: "UNKNOWN_CONTENT_TYPE",
            file: file.name,
            line: i + 1,
            message: `Kode meminta Content Type "${slug}", tetapi schema workspace tidak punya Content Type dengan slug itu.`,
          })
        }
      }
      const single = line.match(SINGLE_URL)
      if (single) {
        fileReadsApi = true
        const slug = single[1]
        if (!singleTypes.has(slug)) {
          warnings.push({
            code: "UNKNOWN_SINGLE_TYPE",
            file: file.name,
            line: i + 1,
            message: `Kode meminta Single Type "${slug}", tetapi schema workspace tidak punya Single Type dengan slug itu.`,
          })
        }
      }
    })

    if (fileReadsApi && !STATUS_CHECK.test(file.content)) {
      warnings.push({
        code: "HTTP_STATUS_UNCHECKED",
        file: file.name,
        message: "File ini mengambil konten tetapi tidak memeriksa status HTTP. Kegagalan API akan tampil seperti data kosong.",
      })
    }
  }

  if (readsContent && !sources.some((f) => REVALIDATE.test(f.content))) {
    warnings.push({
      code: "NO_REVALIDATION",
      file: "",
      message: "Site membaca konten tetapi tidak punya hook revalidasi. Perubahan di SaCMS bisa baru terlihat setelah cache kedaluwarsa. Tambahkan route revalidasi dan daftarkan webhook publish/update ke route itu.",
    })
  }

  return warnings
}
