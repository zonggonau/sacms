/**
 * Intelligently extracts human-readable labels and subtitles from content entry data
 */
export function extractEntryLabel(
  entryData: Record<string, any> | string | undefined | null,
  fallbackId?: string
): string {
  if (!entryData) return fallbackId ? fallbackId.substring(0, 8) : "Unknown"
  let d: any = entryData
  if (typeof d === "string") {
    try {
      d = JSON.parse(d)
    } catch {
      return d
    }
  }

  // 1. Direct prioritized field keys (including Indonesian governance & enterprise terms)
  const priorityKeys = [
    "nama_pejabat", "namaPejabat", "pejabat",
    "nama_pegawai", "namaPegawai", "pegawai",
    "nama_lengkap", "namaLengkap", "fullName",
    "name", "nama", "title", "judul", "subject", "label",
    "nama_kategori", "namaKategori", "kategori",
    "nama_instansi", "namaInstansi", "instansi",
    "nama_dinas", "namaDinas", "dinas",
    "nama_perusahaan", "namaPerusahaan", "perusahaan",
    "nama_barang", "namaBarang", "nama_produk", "namaProduk",
    "perihal", "nomor_surat", "nomorSurat", "no_surat",
    "username", "email", "slug"
  ]

  for (const key of priorityKeys) {
    const val = d[key]
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim()
    }
  }

  // 2. Scan all keys for any key containing common title/name markers
  const keys = Object.keys(d)
  for (const k of keys) {
    const lowerKey = k.toLowerCase()
    if (
      lowerKey.includes("nama") ||
      lowerKey.includes("name") ||
      lowerKey.includes("title") ||
      lowerKey.includes("judul") ||
      lowerKey.includes("pejabat") ||
      lowerKey.includes("label") ||
      lowerKey.includes("subject")
    ) {
      const val = d[k]
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim()
      }
    }
  }

  // 3. Fallback to any string property in entry.data (excluding internal metadata/URLs/dates)
  for (const k of keys) {
    const lower = k.toLowerCase()
    if (["id", "tenantid", "createdat", "updatedat", "locale", "status", "documentid"].includes(lower)) continue
    const val = d[k]
    if (typeof val === "string" && val.trim().length > 0 && val.length < 120 && !val.startsWith("http") && !val.startsWith("data:")) {
      return val.trim()
    }
  }

  return fallbackId ? fallbackId.substring(0, 8) : "Unknown"
}

/**
 * Intelligently extracts secondary details (e.g. Jabatan, NIP, Instansi, Email) for subtitles
 */
export function extractEntrySubtitle(
  entryData: Record<string, any> | string | undefined | null,
  mainLabel?: string
): string {
  if (!entryData) return ""
  let d: any = entryData
  if (typeof d === "string") {
    try {
      d = JSON.parse(d)
    } catch {
      return ""
    }
  }

  const subtitleKeys = [
    "jabatan", "pangkat", "golongan", "nip", "nik",
    "instansi", "dinas", "unit_kerja", "organisasi",
    "email", "phone", "nomor_telepon", "telepon",
    "kategori", "kode", "kode_surat", "nomor_surat",
    "role", "deskripsi", "keterangan"
  ]

  for (const key of subtitleKeys) {
    const val = d[key]
    if (typeof val === "string" && val.trim().length > 0 && val.trim() !== mainLabel) {
      return val.trim()
    }
  }

  const keys = Object.keys(d)
  for (const k of keys) {
    const lower = k.toLowerCase()
    if (
      lower.includes("jabatan") ||
      lower.includes("nip") ||
      lower.includes("instansi") ||
      lower.includes("email") ||
      lower.includes("pangkat")
    ) {
      const val = d[k]
      if (typeof val === "string" && val.trim().length > 0 && val.trim() !== mainLabel) {
        return val.trim()
      }
    }
  }

  return ""
}

export interface RelationLabelItem {
  label: string
  subtitle?: string
  data?: Record<string, any>
}

/**
 * Batch fetches human-readable labels and entity data for all relation IDs referenced in entries
 */
export async function batchFetchRelationLabels(
  tenantDb: any,
  tenantId: string,
  entries: any[],
  fields: any[]
): Promise<Record<string, RelationLabelItem>> {
  const relationFieldSlugs = (fields || []).filter((f) => f.type === "relation").map((f) => f.slug)
  const idSet = new Set<string>()

  for (const entry of entries) {
    let d = entry.data
    if (typeof d === "string") {
      try { d = JSON.parse(d) } catch { d = {} }
    }
    d = d || {}

    for (const slug of relationFieldSlugs) {
      const val = d[slug]
      if (typeof val === "string" && val.trim().length > 5) {
        idSet.add(val.trim())
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string" && item.trim().length > 5) {
            idSet.add(item.trim())
          }
        }
      }
    }
  }

  if (idSet.size === 0) return {}

  const ids = Array.from(idSet)
  const labelMap: Record<string, RelationLabelItem> = {}

  try {
    // 1. Fetch from contentEntry
    const relatedEntries = await tenantDb.contentEntry.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, data: true },
    })

    for (const re of relatedEntries) {
      let parsedData = re.data
      if (typeof parsedData === "string") {
        try { parsedData = JSON.parse(parsedData) } catch { parsedData = {} }
      }
      const label = extractEntryLabel(parsedData, re.id)
      const subtitle = extractEntrySubtitle(parsedData, label)
      labelMap[re.id] = { label, subtitle: subtitle || undefined, data: parsedData }
    }

    // 2. Fallback check for singleTypes if any id wasn't in contentEntry
    const missingIds = ids.filter((id) => !labelMap[id])
    if (missingIds.length > 0) {
      const singleTypes = await tenantDb.singleType.findMany({
        where: { id: { in: missingIds } },
        include: { tenants: { where: { tenantId } } },
      })
      for (const st of singleTypes) {
        const tData = st.tenants?.[0]?.data
        let parsedData = tData
        if (typeof parsedData === "string") {
          try { parsedData = JSON.parse(parsedData) } catch { parsedData = { name: st.name } }
        }
        const label = extractEntryLabel(parsedData, st.name)
        const subtitle = extractEntrySubtitle(parsedData, label)
        labelMap[st.id] = { label: label || st.name, subtitle: subtitle || undefined, data: parsedData }
      }
    }
  } catch (error) {
    console.error("Error batch fetching relation labels:", error)
  }

  return labelMap
}
