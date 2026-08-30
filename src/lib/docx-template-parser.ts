import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

export interface ExtractedPlaceholder {
  raw: string
  key: string
  name: string
  inferredType: string
  isRelationField?: boolean
  relationTarget?: string
}

/**
 * Infer the best field type based on the placeholder name
 */
export function inferFieldType(variableName: string): string {
  const v = variableName.toLowerCase().replace(/[^a-z0-9]/g, "")

  if (v.includes("alamat") || v.includes("isi") || v.includes("keterangan") || v.includes("deskripsi") || v.includes("catatan") || v.includes("body")) {
    return "textarea"
  }
  if (v.includes("hp") || v.includes("telp") || v.includes("phone") || v.includes("wa")) {
    return "phone"
  }
  if (v.includes("email") || v.includes("surel")) {
    return "text"
  }
  if (v.includes("nip") || v.includes("nik") || v.includes("nomor") || v.includes("no") || v.includes("umur") || v.includes("tahun") || v.includes("jumlah") || v.includes("kuota") || v.includes("angka")) {
    return "number"
  }
  if (v.includes("tgl") || v.includes("tanggal") || v.includes("date") || v.includes("lahir") || v.includes("waktu")) {
    return "date"
  }
  if (v.includes("gaji") || v.includes("harga") || v.includes("biaya") || v.includes("nominal") || v.includes("tarif") || v.includes("rp") || v.includes("amount")) {
    return "currency"
  }
  if (v.includes("foto") || v.includes("gambar") || v.includes("image") || v.includes("logo") || v.includes("lampiran") || v.includes("file") || v.includes("ttd") || v.includes("paraf")) {
    return "media"
  }

  return "text"
}

/**
 * Generate human-readable label from slug
 * Example: 'nama_pejabat' -> 'Nama Pejabat', 'nomor_surat' -> 'Nomor Surat'
 */
export function generateReadableName(slug: string): string {
  if (!slug) return ""
  return slug
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Extract all {placeholder} and {nested.placeholder} variables from a DOCX binary / ArrayBuffer
 */
export function extractDocxPlaceholdersFromBuffer(buffer: ArrayBuffer | Uint8Array | string): ExtractedPlaceholder[] {
  try {
    const zip = new PizZip(buffer)
    const placeholderSet = new Set<string>()
    const tagRegex = /\{([^{}]+)\}/g

    // Method 1: Use Docxtemplater getFullText() for consolidated text stream
    try {
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
      const fullText = doc.getFullText()
      let match: RegExpExecArray | null
      while ((match = tagRegex.exec(fullText)) !== null) {
        const rawTag = match[1].trim()
        const cleanTag = rawTag.replace(/^([#\/\^>@%]\s*)/, "").trim()
        if (cleanTag && !cleanTag.includes("<") && !cleanTag.includes(">") && !cleanTag.startsWith("w:")) {
          placeholderSet.add(cleanTag)
        }
      }
    } catch (e) {
      // Fallback to XML scanning
    }

    // Method 2: Comprehensive XML scanner across document, headers, footers, footnotes, tables
    const xmlFiles = Object.keys(zip.files).filter(
      name => name.startsWith("word/") && (name.endsWith(".xml") || name.endsWith(".xml.rels"))
    )

    for (const fileName of xmlFiles) {
      const file = zip.file(fileName)
      if (!file) continue

      const content = file.asText()
      // Strip XML elements while preserving text
      const strippedXml = content.replace(/<[^>]+>/g, "")

      let match: RegExpExecArray | null
      const localRegex = /\{([^{}]+)\}/g
      while ((match = localRegex.exec(strippedXml)) !== null) {
        const rawTag = match[1].trim()
        const cleanTag = rawTag.replace(/^([#\/\^>@%]\s*)/, "").trim()

        if (!cleanTag || cleanTag.startsWith("w:") || cleanTag.includes("<") || cleanTag.includes(">")) {
          continue
        }

        placeholderSet.add(cleanTag)
      }
    }

    const results: ExtractedPlaceholder[] = []

    for (const key of Array.from(placeholderSet)) {
      const slug = key.toLowerCase().replace(/[^a-z0-9_.]/g, "_")
      const readable = generateReadableName(key)
      const inferred = inferFieldType(key)

      results.push({
        raw: `{${key}}`,
        key: slug,
        name: readable,
        inferredType: inferred,
      })
    }

    return results
  } catch (error) {
    console.error("[EXTRACT_DOCX_ERROR]:", error)
    return []
  }
}
