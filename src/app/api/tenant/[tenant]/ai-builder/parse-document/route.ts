import { NextResponse } from "next/server"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { validateMagicBytes, MAX_FILE_SIZE } from "@/lib/validations"
import { analyzeDocxBuffer, analyzeXlsxBuffer, analyzePdfBuffer } from "@/lib/document-analysis"

/**
 * POST /api/tenant/[tenant]/ai-builder/parse-document
 *
 * Server-side analysis for the AI Schema Generator's "reference document"
 * attachment (schema-step.tsx) when it's a binary format the browser can't
 * just read as plain text: .docx, .xlsx/.xls, .pdf. The simpler .txt/.md/
 * .csv/.json case stays on the client's existing FileReader.readAsText path
 * — this route exists only for the three binary formats, and parses with
 * Node libraries rather than shipping a PDF/spreadsheet parser to the browser.
 *
 * No AI credits are spent here — this is pure text/structure extraction,
 * fed into the prompt the user later sends to /ai-builder/plan-schema
 * (which is where the real, billed AI call happens).
 *
 * `xlsx` reuses the DOCX zip-signature check (both formats are OOXML zip
 * containers) and `xls` reuses the legacy msword OLE-or-zip check — xlsx's
 * own binary format predates a dedicated signature in validateMagicBytes,
 * and this route's upload isn't stored/served back like the media library's,
 * so a loose-but-real byte check is an acceptable layer here.
 */
const EXTENSION_HANDLERS: Record<
  string,
  { parse: (buf: Buffer) => Promise<unknown>; magicMime: string }
> = {
  docx: { parse: analyzeDocxBuffer, magicMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { parse: analyzeXlsxBuffer, magicMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { parse: analyzeXlsxBuffer, magicMime: "application/msword" },
  pdf: { parse: analyzePdfBuffer, magicMime: "application/pdf" },
}

export const POST = withStaffAuth(async (request) => {
  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return apiError("validation", { message: "Berkas tidak ditemukan dalam permintaan" })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  const handlerEntry = EXTENSION_HANDLERS[ext]
  if (!handlerEntry) {
    return apiError("validation", { message: "Format berkas tidak didukung. Gunakan .docx, .xlsx, .xls, atau .pdf." })
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return apiError("validation", { message: `Berkas terlalu besar. Maksimal ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.` })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!validateMagicBytes(buffer, handlerEntry.magicMime)) {
    return apiError("validation", { message: `Isi berkas tidak cocok dengan ekstensi .${ext} — kemungkinan rusak atau bukan berkas asli.` })
  }

  try {
    const result = await handlerEntry.parse(buffer)
    return NextResponse.json({ success: true, fileName: file.name, fileType: ext, ...(result as object) })
  } catch (err: any) {
    console.error("[parse-document] failed:", err)
    return apiError("internal", { message: `Gagal menganalisa dokumen: ${err.message || "berkas mungkin rusak"}` })
  }
}, { minRole: "admin" })
