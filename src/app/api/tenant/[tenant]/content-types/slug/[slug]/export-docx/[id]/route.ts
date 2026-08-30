import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import fs from "fs"
import path from "path"

/**
 * Helper to clean HTML tags from rich text/textarea values
 */
function cleanVal(val: any): string {
  if (val === undefined || val === null) return ""
  if (typeof val === "string") {
    return val.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").trim()
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val)
  }
  if (Array.isArray(val)) {
    return val.map(cleanVal).join(", ")
  }
  if (typeof val === "object") {
    if ("number" in val) {
      return `${val.code || ""} ${val.number || ""}`.trim()
    }
    if ("url" in val) {
      return String(val.url)
    }
    return ""
  }
  return String(val)
}

/**
 * Helper to escape special XML characters for OpenXML Word documents (Fallback generator)
 */
function escapeXml(unsafe: string): string {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Generate a clean, official DOCX document Buffer from scratch (OpenXML compliant)
 * Used as fallback ONLY when no custom Word template was uploaded.
 */
function generateOfficialDocxXml(title: string, entryData: Record<string, unknown>, meta: { tenantName: string; entryId: string; date: string }): string {
  const rowsXml = Object.entries(entryData)
    .filter(([k]) => !k.startsWith("_"))
    .map(([key, val]) => {
      const label = key.replace(/_/g, " ").toUpperCase()
      const displayVal = typeof val === "object" && val !== null ? JSON.stringify(val) : String(val ?? "-")
      return `
        <w:tr>
          <w:tc>
            <w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="6000" w:type="dxa"/></w:tcPr>
            <w:p><w:r><w:rPr><w:sz w:val="22"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>${escapeXml(displayVal)}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>${escapeXml(meta.tenantName.toUpperCase())}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="4" w:color="000000"/></w:pBdr></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>SISTEM DOKUMEN &amp; FORMAT SURAT RESMI</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="26"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>${escapeXml(title.toUpperCase())}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>Nomor Ref / ID: ${escapeXml(meta.entryId)}</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="D3D3D3"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D3D3D3"/>
          <w:right w:val="none"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E5E5"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      ${rowsXml}
    </w:tbl>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t>Diterbitkan pada: ${escapeXml(meta.date)}</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, slug: contentTypeSlug, id: entryId } = await context.params

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantDb = await getTenantDb(access.tenant.slug)

    // 1. Fetch content type and schema fields
    const contentType = await tenantDb.contentType.findFirst({
      where: {
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : []),
        ],
      },
      include: {
        schemaFields: true,
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // 2. Fetch entry data
    const entry = await tenantDb.contentEntry.findFirst({
      where: {
        id: entryId,
        contentTypeId: contentType.id,
        tenantId: access.tenantId,
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    let entryData: Record<string, any> = {}
    if (typeof entry.data === "string") {
      try {
        entryData = JSON.parse(entry.data)
      } catch {
        entryData = {}
      }
    } else if (entry.data && typeof entry.data === "object") {
      entryData = entry.data as Record<string, any>
    }

    // 3. Check for uploaded template in document_template field or contentType.docxTemplateUrl
    const docField = contentType.schemaFields.find((f) => f.type === "document_template")
    let templateUrl: string | null = contentType.docxTemplateUrl || null
    if (!templateUrl && docField?.options) {
      try {
        const opts = typeof docField.options === "string" ? JSON.parse(docField.options) : docField.options
        templateUrl = (opts as any)?.templateUrl || (opts as any)?.fileUrl || null
      } catch {
        templateUrl = null
      }
    }
    if (!templateUrl && docField && entryData[docField.slug]) {
      const val = entryData[docField.slug]
      if (typeof val === "string" && (val.startsWith("/") || val.startsWith("http"))) {
        templateUrl = val
      } else if (typeof val === "object" && val?.url) {
        templateUrl = val.url
      }
    }

    const title = String(entryData.judul_surat || entryData.judul || entryData.title || entryData.name || entryData.nama || contentType.name)
    const formattedDate = new Date(entry.createdAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

    let templateBuffer: Buffer | null = null
    if (templateUrl) {
      try {
        if (templateUrl.startsWith("/upload/") || templateUrl.startsWith("/")) {
          const localPath = path.join(process.cwd(), "public", templateUrl)
          if (fs.existsSync(localPath)) {
            templateBuffer = fs.readFileSync(localPath)
          }
        } else if (templateUrl.startsWith("http://") || templateUrl.startsWith("https://")) {
          const res = await fetch(templateUrl)
          if (res.ok) {
            const arr = await res.arrayBuffer()
            templateBuffer = Buffer.from(arr)
          }
        }
      } catch (err) {
        console.error("[LOAD_TEMPLATE_ERROR]:", err)
      }
    }

    let finalDocxBuffer: Buffer

    if (templateBuffer) {
      // 4. Use Docxtemplater to merge real uploaded template file with entry variables
      const PizZip = (await import("pizzip")).default || (await import("pizzip"))
      const Docxtemplater = (await import("docxtemplater")).default || (await import("docxtemplater"))

      const templateVars: Record<string, any> = {
        tenant_name: access.tenant.name,
        tenantName: access.tenant.name,
        entry_id: entry.id,
        id: entry.id,
        tanggal_dibuat: formattedDate,
        tanggal: formattedDate,
        date: formattedDate,
      }

      // Populate main fields
      for (const [k, v] of Object.entries(entryData)) {
        templateVars[k] = cleanVal(v)
      }

      // Resolve relation fields (e.g. pejabat, kategori, etc.)
      for (const field of contentType.schemaFields) {
        if (field.type === "relation" || field.relationSlug) {
          const relVal = entryData[field.slug]
          if (typeof relVal === "string" && relVal.trim().length > 5) {
            const relEntry = await tenantDb.contentEntry.findFirst({
              where: { id: relVal.trim() },
              select: { id: true, data: true },
            })

            if (relEntry) {
              let relData: Record<string, any> = {}
              if (typeof relEntry.data === "string") {
                try {
                  relData = JSON.parse(relEntry.data)
                } catch {
                  relData = {}
                }
              } else if (relEntry.data && typeof relEntry.data === "object") {
                relData = relEntry.data as Record<string, any>
              }

              const relLabel =
                relData.nama_pejabat ||
                relData.nama ||
                relData.name ||
                relData.title ||
                relData.judul ||
                relEntry.id

              // Flat attributes
              for (const [rk, rv] of Object.entries(relData)) {
                templateVars[rk] = cleanVal(rv)
                templateVars[`${field.slug}_${rk}`] = cleanVal(rv)
              }

              // Nested object support
              templateVars[field.slug] = {
                ...relData,
                label: relLabel,
              }
            }
          }
        }
      }

      const zip = new PizZip(templateBuffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
      })

      doc.render(templateVars)

      finalDocxBuffer = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      })
    } else {
      // 5. Fallback: generate default structured official docx
      const documentXml = generateOfficialDocxXml(title, entryData, {
        tenantName: access.tenant.name,
        entryId: entry.id,
        date: formattedDate,
      })

      const JSZip = (await import("jszip")).default || (await import("jszip"))
      const zip = new JSZip()

      zip.file(
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
      )

      zip.file(
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
      )

      zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`)

      zip.file("word/document.xml", documentXml)

      finalDocxBuffer = (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })) as Buffer
    }

    const safeFileName = `${contentTypeSlug}_${entryId}.docx`.replace(/[^a-zA-Z0-9._-]/g, "_")

    return new NextResponse(finalDocxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error: any) {
    console.error("[EXPORT_DOCX_ERROR]:", error)
    return NextResponse.json({ error: error.message || "Failed to generate document" }, { status: 500 })
  }
}
