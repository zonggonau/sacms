import { describe, it, expect } from "vitest"
import { inferFieldType, generateReadableName, extractDocxPlaceholdersFromBuffer } from "@/lib/docx-template-parser"
import PizZip from "pizzip"

describe("docx-template-parser", () => {
  it("should infer correct field types from variable names", () => {
    expect(inferFieldType("alamat_lengkap")).toBe("textarea")
    expect(inferFieldType("nomor_surat")).toBe("number")
    expect(inferFieldType("hp_karyawan")).toBe("phone")
    expect(inferFieldType("tanggal_lahir")).toBe("date")
    expect(inferFieldType("gaji_pokok")).toBe("currency")
    expect(inferFieldType("foto_profil")).toBe("media")
    expect(inferFieldType("nama_pejabat")).toBe("text")
  })

  it("should generate readable names from slugs", () => {
    expect(generateReadableName("nama_pejabat")).toBe("Nama Pejabat")
    expect(generateReadableName("nomor_surat_keluar")).toBe("Nomor Surat Keluar")
    expect(generateReadableName("tgl_terbit")).toBe("Tgl Terbit")
  })

  it("should extract placeholders correctly from a mock DOCX zip structure", () => {
    const zip = new PizZip()
    const mockDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Surat Keputusan untuk {nama}</w:t></w:r></w:p>
          <w:p><w:r><w:t>Alamat: {alamat}</w:t></w:r></w:p>
          <w:p><w:r><w:t>Nomor HP: {hp}</w:t></w:r></w:p>
          <w:p><w:r><w:t>Pejabat yang mengesahkan: {nama_pejabat}</w:t></w:r></w:p>
          <w:p><w:r><w:t>NIP: {nip}</w:t></w:r></w:p>
        </w:body>
      </w:document>`

    zip.file("word/document.xml", mockDocumentXml)
    const buffer = zip.generate({ type: "nodebuffer" })

    const placeholders = extractDocxPlaceholdersFromBuffer(buffer)
    expect(placeholders.length).toBe(5)

    const slugs = placeholders.map((p) => p.key)
    expect(slugs).toContain("nama")
    expect(slugs).toContain("alamat")
    expect(slugs).toContain("hp")
    expect(slugs).toContain("nama_pejabat")
    expect(slugs).toContain("nip")
  })
})
