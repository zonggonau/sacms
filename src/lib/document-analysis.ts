import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { extractDocxPlaceholdersFromBuffer, type ExtractedPlaceholder } from "@/lib/docx-template-parser"

// Mirrors MAX_ATTACHMENT_CHARS already used for plain-text attachments in
// schema-step.tsx — keeps every attachment kind within the same AI prompt
// budget regardless of source format.
const MAX_EXTRACTED_CHARS = 20_000

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: string[][]
}

export interface DocumentAnalysisResult {
  fullText: string
  truncated: boolean
  placeholders?: ExtractedPlaceholder[]
  sheets?: ParsedSheet[]
}

function capText(text: string): { fullText: string; truncated: boolean } {
  const truncated = text.length > MAX_EXTRACTED_CHARS
  return { fullText: text.slice(0, MAX_EXTRACTED_CHARS), truncated }
}

/**
 * Extracts both the readable full text AND any {placeholder} letter
 * variables from a .docx — the same detection the document_template field's
 * upload wizard already uses (docx-template-parser.ts), reused here so a
 * schema built from this analysis uses the exact same slugs the template
 * merge will later look for.
 */
export async function analyzeDocxBuffer(buffer: Buffer): Promise<DocumentAnalysisResult> {
  const placeholders = extractDocxPlaceholdersFromBuffer(buffer)

  let rawText = ""
  try {
    const zip = new PizZip(buffer)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
    rawText = doc.getFullText()
  } catch {
    // Malformed/unparseable document — placeholders (if any were still
    // found by the more tolerant XML scan inside extractDocxPlaceholdersFromBuffer)
    // remain useful signal even without the full body text.
  }

  const { fullText, truncated } = capText(rawText)
  return { fullText, truncated, placeholders }
}

/**
 * Reads every sheet (capped) of an .xlsx/.xls workbook into a header row +
 * a handful of sample rows — enough for the AI to infer column names/types
 * without shipping an entire spreadsheet's worth of tokens into the prompt.
 */
export async function analyzeXlsxBuffer(buffer: Buffer): Promise<DocumentAnalysisResult> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buffer, { type: "buffer" })

  const MAX_SHEETS = 5
  const MAX_SAMPLE_ROWS = 10

  const sheets: ParsedSheet[] = []
  const textParts: string[] = []

  for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
    const headers = (rows[0] || []).map((h) => String(h ?? "").trim())
    const sampleRows = rows.slice(1, 1 + MAX_SAMPLE_ROWS).map((r) => r.map((c) => String(c ?? "")))
    sheets.push({ name: sheetName, headers, rows: sampleRows })

    textParts.push(`Sheet "${sheetName}" — kolom: ${headers.join(", ") || "(tidak terdeteksi)"}`)
    for (const row of sampleRows) textParts.push(row.join(" | "))
  }

  const { fullText, truncated } = capText(textParts.join("\n"))
  return { fullText, truncated, sheets }
}

/** Plain text extraction from a PDF — no OCR, so a scanned/image-only PDF yields empty text. */
export async function analyzePdfBuffer(buffer: Buffer): Promise<DocumentAnalysisResult> {
  const { default: pdfParse } = await import("pdf-parse")
  const data = await pdfParse(buffer)
  const { fullText, truncated } = capText(data.text || "")
  return { fullText, truncated }
}
