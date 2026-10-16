import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface InvoiceData {
  orderId: string
  amount: number
  status: string // 'paid' | 'success' | 'settlement' | 'pending' | 'draft' | 'cancel' | 'cancelled' | 'expire' | 'expired' | 'failed'
  date: string
  customerName?: string
  customerEmail?: string
  planName?: string
  description?: string
  paymentMethod?: string
}

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  navy:   [10,  17,  40 ] as [number,number,number],
  blue:   [37,  99,  235] as [number,number,number],
  slate:  [71,  85,  105] as [number,number,number],
  dark:   [15,  23,  42 ] as [number,number,number],
  light:  [248, 250, 252] as [number,number,number],
  border: [226, 232, 240] as [number,number,number],
  white:  [255, 255, 255] as [number,number,number],
  green:  [21,  128, 61 ] as [number,number,number],
  amber:  [180, 120, 10 ] as [number,number,number],
  red:    [185, 28,  28 ] as [number,number,number],
}

function rgb(doc: jsPDF, c: [number,number,number], type: 'fill'|'text'|'draw' = 'text') {
  if (type === 'fill') doc.setFillColor(c[0], c[1], c[2])
  if (type === 'draw') doc.setDrawColor(c[0], c[1], c[2])
  if (type === 'text') doc.setTextColor(c[0], c[1], c[2])
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ─── Layout constants ──────────────────────────────────────────────────
  const W   = 210   // page width (A4)
  const H   = 297   // page height (A4)
  const ML  = 15    // margin left   (content start)
  const MR  = 195   // margin right  (content end — border reference)
  const TR  = 190   // text right    (right-aligned text anchor, 5mm inset from MR)

  // ─── Calculations ──────────────────────────────────────────────────────
  const total    = data.amount
  const subtotal = Math.round(total / 1.11)
  const ppn      = total - subtotal
  const fmt      = (n: number) => `Rp\u00A0${n.toLocaleString('id-ID')}`   // non-breaking space

  const st = (data.status || '').toLowerCase()
  const isPaid = st === 'success' || st === 'settlement' || st === 'paid'
  const isPending = st === 'pending' || st === 'draft' || st === 'unpaid'
  const isCancelled = st === 'cancel' || st === 'cancelled' || st === 'expire' || st === 'expired' || st === 'deny' || st === 'failed'

  const statusLabel = isPaid 
    ? 'LUNAS (PAID)' 
    : isPending 
    ? 'MENUNGGU (PENDING)' 
    : 'DIBATALKAN (CANCEL)'

  const statusColor = isPaid ? C.green : isPending ? C.amber : C.red

  /* ═══════════════════════════════════════════════════════════════════════
     1. HEADER BAND
  ═══════════════════════════════════════════════════════════════════════ */
  rgb(doc, C.navy, 'fill')
  doc.rect(0, 0, W, 52, 'F')

  // Brand
  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('SaCMS', ML, 21)

  // Tagline
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(180, 190, 210)
  doc.text('Enterprise Headless CMS  ·  billing@sacms.cloud  ·  sacms.cloud', ML, 29)

  // "INVOICE" — right side, with proper right inset
  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('INVOICE', TR, 24, { align: 'right' })

  // Invoice number
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 210)
  doc.text(`# ${data.orderId}`, TR, 33, { align: 'right' })

  /* ═══════════════════════════════════════════════════════════════════════
     2. ACCENT LINE
  ═══════════════════════════════════════════════════════════════════════ */
  rgb(doc, C.blue, 'fill')
  doc.rect(0, 52, W, 3, 'F')

  /* ═══════════════════════════════════════════════════════════════════════
     3. META CARDS
  ═══════════════════════════════════════════════════════════════════════ */
  const cardY  = 64
  const cardH  = 40
  const gap    = 6
  const totalW = MR - ML               // 180mm
  const card1W = totalW * 0.58         // ~104mm
  const card2W = totalW - card1W - gap // ~70mm

  rgb(doc, C.light, 'fill')
  rgb(doc, C.border, 'draw')
  doc.setLineWidth(0.3)
  doc.roundedRect(ML,              cardY, card1W,  cardH, 2, 2, 'FD')
  doc.roundedRect(ML + card1W + gap, cardY, card2W, cardH, 2, 2, 'FD')

  // Card 1 — Billed To
  const c1xi = ML + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 140, 165)
  doc.text('TAGIHAN KEPADA', c1xi, cardY + 9)

  rgb(doc, C.dark, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.customerName || 'Customer', c1xi, cardY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 130, 155)
  doc.text(data.customerEmail || '-', c1xi, cardY + 26)

  // Card 2 — Invoice Details
  const c2xi  = ML + card1W + gap + 6         // text-left inside card 2
  const c2xr  = ML + card1W + gap + card2W - 6 // text-right inside card 2 (6mm inset)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 140, 165)
  doc.text('DETAIL INVOICE', c2xi, cardY + 9)

  const metaRows: [string, string, boolean][] = [
    ['Tanggal',    data.date,   false],
    ['Metode',     data.paymentMethod || 'Midtrans Gateway', false],
    ['Status',     statusLabel, true ],
  ]
  metaRows.forEach(([label, val, isStatus], i) => {
    const ry = cardY + 18 + i * 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(120, 140, 165)
    doc.text(label, c2xi, ry)

    if (isStatus) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    } else {
      rgb(doc, C.dark, 'text')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
    }
    doc.text(val, c2xr, ry, { align: 'right' })
  })

  /* ═══════════════════════════════════════════════════════════════════════
     4. ITEMS TABLE
  ═══════════════════════════════════════════════════════════════════════ */
  const tableY = cardY + cardH + 10
  const itemDesc = data.description || (data.planName ? `SaCMS — Paket ${data.planName}` : 'SaCMS — Pembayaran / Upgrade Layanan Cloud & AI')

  autoTable(doc, {
    startY: tableY,
    head: [['#', 'Deskripsi Layanan', 'Qty', 'Harga Satuan', 'Jumlah']],
    body: [
      [
        '01',
        itemDesc,
        '1',
        fmt(subtotal),
        fmt(subtotal),
      ],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      overflow: 'visible',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: C.dark,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineColor: C.border,
      lineWidth: 0.2,
      overflow: 'visible',
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 78, overflow: 'ellipsize' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: C.light },
    margin: { left: ML, right: W - MR },
  })

  /* ═══════════════════════════════════════════════════════════════════════
     5. TOTALS BLOCK
  ═══════════════════════════════════════════════════════════════════════ */
  const finalY = (doc as any).lastAutoTable?.finalY ?? tableY + 30
  const totBlockW = 85
  const totLX     = MR - totBlockW        // label x
  const totVX     = TR                    // value x (5mm inset from MR)

  let ty = finalY + 12

  const drawSummaryRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    rgb(doc, C.slate, 'text')
    doc.text(label, totLX, ty)
    rgb(doc, C.dark, 'text')
    doc.text(value, totVX, ty, { align: 'right' })
    ty += 7
  }

  drawSummaryRow('Subtotal (DPP)', fmt(subtotal))
  drawSummaryRow('PPN 11%',        fmt(ppn))

  // Grand total stripe
  rgb(doc, isPaid ? C.blue : isPending ? C.amber : C.red, 'fill')
  doc.rect(totLX - 5, ty, totBlockW + 5, 13, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  rgb(doc, C.white, 'text')
  doc.text('TOTAL PEMBAYARAN', totLX, ty + 8)
  doc.text(fmt(total), totVX, ty + 8, { align: 'right' })
  ty += 19

  /* ═══════════════════════════════════════════════════════════════════════
     6. NOTES — left column, sits beside totals
  ═══════════════════════════════════════════════════════════════════════ */
  const noteY = finalY + 12
  rgb(doc, C.dark, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Catatan:', ML, noteY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  rgb(doc, C.slate, 'text')
  const notes = [
    '• Pembayaran diproses secara otomatis melalui gerbang Midtrans.',
    '• Simpan dokumen invoice ini sebagai bukti transaksi resmi.',
    '• Butuh bantuan atau e-Faktur? Hubungi: billing@sacms.cloud',
  ]
  notes.forEach((n, i) => doc.text(n, ML, noteY + 8 + i * 7))

  /* ═══════════════════════════════════════════════════════════════════════
     7. WATERMARK (PAID / DRAFT / CANCEL)
  ═══════════════════════════════════════════════════════════════════════ */
  doc.saveGraphicsState()
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(60)
  if (isPaid) {
    doc.setTextColor(21, 128, 61)
    doc.text('LUNAS', W / 2, H / 2, { align: 'center', angle: -35 })
  } else if (isCancelled) {
    doc.setTextColor(185, 28, 28)
    doc.text('DIBATALKAN', W / 2, H / 2, { align: 'center', angle: -35 })
  } else {
    doc.setTextColor(180, 120, 10)
    doc.text('DRAFT / MENUNGGU', W / 2, H / 2, { align: 'center', angle: -35 })
  }
  doc.restoreGraphicsState()

  /* ═══════════════════════════════════════════════════════════════════════
     8. FOOTER BAR
  ═══════════════════════════════════════════════════════════════════════ */
  rgb(doc, C.navy, 'fill')
  doc.rect(0, H - 22, W, 22, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 175, 200)
  doc.text(
    'Dokumen ini dibuat secara otomatis oleh sistem SaCMS. Tidak memerlukan tanda tangan.',
    W / 2, H - 13, { align: 'center' }
  )
  doc.setTextColor(120, 135, 165)
  doc.text(`© ${new Date().getFullYear()} SaCMS, Inc. — www.sacms.com`, W / 2, H - 6, { align: 'center' })

  doc.setTextColor(180, 190, 210)
  doc.setFontSize(7.5)
  // Footer page number: inset 5mm from right
  doc.text('Halaman 1 / 1', TR, H - 6, { align: 'right' })

  /* ═══════════════════════════════════════════════════════════════════════
     9. SAVE
  ═══════════════════════════════════════════════════════════════════════ */
  doc.save(`Invoice_${data.orderId}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────
// License / enterprise contract document
// ─────────────────────────────────────────────────────────────────────────

export interface LicenseContractData {
  licenseId: string
  displayKey?: string
  customerName: string
  customerEmail?: string
  organization?: string
  type: string // "enterprise" | "partner" | "trial"
  storageGb?: number | null
  aiCredits?: number | null
  maxWorkspaces?: number | null
  priceIdr?: number | null
  issuedAt: string | Date
  expiresAt: string | Date
}

const TYPE_LABEL: Record<string, string> = {
  enterprise: 'Enterprise (Dedicated)',
  partner: 'Partner / Reseller',
  trial: 'Trial (Evaluasi)',
}

function formatIdDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatStorage(gb: number) {
  return gb >= 1024 ? `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB` : `${gb} GB`
}

function formatRupiahPdf(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

/**
 * Generates a base-form license agreement between SaCMS and the licensee,
 * populated from the EnterpriseLicense record. This is a draft/template
 * document (commercial value and bespoke clauses are left blank for the
 * parties to fill in and negotiate) — it is explicitly labelled as such so
 * it is never mistaken for a final, lawyer-reviewed contract.
 */
export function generateLicenseContractPDF(data: LicenseContractData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const H = 297
  const ML = 15
  const MR = 195
  const TR = 190

  const typeLabel = TYPE_LABEL[data.type] || data.type
  const refCode = data.displayKey || data.licenseId.slice(0, 10)
  const totalDays = Math.max(
    0,
    Math.round(
      (new Date(data.expiresAt).getTime() - new Date(data.issuedAt).getTime()) / 86400000
    )
  )

  /* ═══ 1. HEADER BAND ═══ */
  rgb(doc, C.navy, 'fill')
  doc.rect(0, 0, W, 38, 'F')

  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('SaCMS', ML, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 190, 210)
  doc.text('Enterprise Headless CMS  ·  legal@sacms.cloud  ·  sacms.cloud', ML, 22)

  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('SURAT PERJANJIAN', TR, 14, { align: 'right' })
  doc.text('LISENSI ENTERPRISE', TR, 21, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 190, 210)
  doc.text(`Ref: ${refCode}`, TR, 28, { align: 'right' })

  /* ═══ 2. ACCENT LINE ═══ */
  rgb(doc, C.blue, 'fill')
  doc.rect(0, 38, W, 3, 'F')

  /* ═══ 3. PARTY CARDS ═══ */
  const cardY = 49
  const cardH = 34
  const gap = 6
  const totalW = MR - ML
  const cardW = (totalW - gap) / 2

  rgb(doc, C.light, 'fill')
  rgb(doc, C.border, 'draw')
  doc.setLineWidth(0.3)
  doc.roundedRect(ML, cardY, cardW, cardH, 2, 2, 'FD')
  doc.roundedRect(ML + cardW + gap, cardY, cardW, cardH, 2, 2, 'FD')

  // Card 1 — Pihak Pertama (Penyedia)
  const c1x = ML + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 140, 165)
  doc.text('PIHAK PERTAMA (PENYEDIA)', c1x, cardY + 8)

  rgb(doc, C.dark, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SaCMS, Inc.', c1x, cardY + 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110, 130, 155)
  doc.text('Penyedia platform SaaS — legal@sacms.cloud', c1x, cardY + 24)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text('Selanjutnya disebut "Penyedia"', c1x, cardY + 30)

  // Card 2 — Pihak Kedua (Pelanggan)
  const c2x = ML + cardW + gap + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 140, 165)
  doc.text('PIHAK KEDUA (PELANGGAN)', c2x, cardY + 8)

  rgb(doc, C.dark, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.organization || data.customerName, c2x, cardY + 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110, 130, 155)
  const picLine = data.customerEmail
    ? `${data.customerName} · ${data.customerEmail}`
    : data.customerName
  doc.text(picLine, c2x, cardY + 24, { maxWidth: cardW - 12 })

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text('Selanjutnya disebut "Pelanggan"', c2x, cardY + 30)

  /* ═══ 4. LICENSE TERMS TABLE ═══ */
  const tableY = cardY + cardH + 8
  autoTable(doc, {
    startY: tableY,
    head: [['Ketentuan Lisensi', 'Detail']],
    body: [
      ['Tipe Lisensi', typeLabel],
      ['Tanggal Mulai', formatIdDate(data.issuedAt)],
      ['Tanggal Berakhir', formatIdDate(data.expiresAt)],
      ['Masa Berlaku', `${totalDays} hari`],
      ['Kuota Workspace', data.maxWorkspaces ? (data.maxWorkspaces >= 999999 ? 'Unlimited' : `Maks. ${data.maxWorkspaces.toLocaleString('id-ID')} workspace`) : 'Tidak berlaku'],
      ['Kuota Storage Gabungan', data.storageGb ? `${formatStorage(data.storageGb)} (dibagi ke seluruh workspace Pelanggan)` : 'Tidak berlaku'],
      ['Kuota AI Credits', data.aiCredits ? `${data.aiCredits.toLocaleString('id-ID')} credits / masa berlaku` : 'Tidak berlaku'],
      ['Nilai Kontrak', data.priceIdr != null ? formatRupiahPdf(data.priceIdr) : 'Belum ditentukan'],
      ['Referensi Lisensi', refCode],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: C.dark,
      cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      lineColor: C.border,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: totalW - 60 },
    },
    alternateRowStyles: { fillColor: C.light },
    margin: { left: ML, right: W - MR },
  })

  /* ═══ 5. ARTICLES (PASAL) ═══ */
  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 60) + 10
  const bodyWidth = MR - ML

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 30) {
      doc.addPage()
      y = 20
    }
  }

  const drawArticle = (title: string, body: string) => {
    const lines = doc.splitTextToSize(body, bodyWidth)
    ensureSpace(10 + lines.length * 4.6)
    rgb(doc, C.dark, 'text')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(title, ML, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    rgb(doc, C.slate, 'text')
    doc.text(lines, ML, y)
    y += lines.length * 4.6 + 5
  }

  drawArticle(
    'Pasal 1 — Objek Perjanjian',
    'Penyedia memberikan hak penggunaan platform SaCMS kepada Pelanggan sesuai dengan ketentuan lisensi yang tercantum pada tabel di atas, termasuk kuota workspace, storage gabungan, dan/atau AI credits apabila berlaku. Kuota workspace ditegakkan langsung oleh sistem — pembuatan workspace di luar kuota akan ditolak otomatis sampai Pelanggan menambah kuota.'
  )
  drawArticle(
    'Pasal 2 — Jangka Waktu dan Pengakhiran',
    'Perjanjian ini berlaku mulai Tanggal Mulai hingga Tanggal Berakhir sebagaimana tercantum di atas. Apabila lisensi tidak diperpanjang sebelum Tanggal Berakhir, sistem akan terkunci otomatis (hard lockout) dan hanya dapat dibuka kembali melalui penerbitan lisensi baru oleh Penyedia — Pelanggan tidak dapat membuka kunci tersebut secara mandiri.'
  )
  drawArticle(
    'Pasal 3 — Kerahasiaan dan Pembatasan Penggunaan',
    'Pelanggan wajib menjaga kerahasiaan kunci lisensi (license key) yang diterbitkan untuknya, dan tidak melakukan rekayasa balik (reverse engineering), modifikasi, duplikasi, maupun pengalihan lisensi ini kepada pihak lain tanpa persetujuan tertulis dari Penyedia.'
  )
  drawArticle(
    'Pasal 4 — Nilai Kontrak dan Pembayaran',
    data.priceIdr != null
      ? `Nilai kontrak sebesar ${formatRupiahPdf(data.priceIdr)} untuk masa berlaku ${totalDays} hari sebagaimana tercantum pada tabel di atas. Cara dan jadwal pembayaran disepakati secara terpisah oleh kedua pihak dan dicantumkan pada lampiran/addendum perjanjian ini.`
      : 'Nilai kontrak: Rp ___________________________ , dengan cara dan jadwal pembayaran yang disepakati secara terpisah oleh kedua pihak dan dicantumkan pada lampiran/addendum perjanjian ini.'
  )
  drawArticle(
    'Pasal 5 — Lain-lain',
    'Hal-hal yang belum atau belum cukup diatur dalam perjanjian ini akan diatur lebih lanjut dalam addendum yang disepakati bersama secara tertulis oleh kedua pihak.'
  )

  /* ═══ 6. SIGNATURES ═══ */
  ensureSpace(55)
  y += 6
  const sigColW = bodyWidth / 2
  const sig1X = ML
  const sig2X = ML + sigColW

  rgb(doc, C.dark, 'text')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Pihak Pertama,', sig1X, y)
  doc.text('Pihak Kedua,', sig2X, y)

  const lineY = y + 28
  doc.setDrawColor(C.dark[0], C.dark[1], C.dark[2])
  doc.setLineWidth(0.2)
  doc.line(sig1X, lineY, sig1X + 60, lineY)
  doc.line(sig2X, lineY, sig2X + 60, lineY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('SaCMS, Inc.', sig1X, lineY + 5)
  doc.text(data.organization || data.customerName, sig2X, lineY + 5, { maxWidth: sigColW - 6 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  rgb(doc, C.slate, 'text')
  doc.text('Nama & Jabatan, Tanggal', sig1X, lineY + 10)
  doc.text('Nama & Jabatan, Tanggal', sig2X, lineY + 10)

  /* ═══ 7. FOOTER BAR (every page) ═══ */
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    rgb(doc, C.navy, 'fill')
    doc.rect(0, H - 20, W, 20, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(160, 175, 200)
    doc.text(
      'Dokumen ini adalah draf dasar yang dibuat otomatis oleh sistem SaCMS — tinjau bersama tim legal kedua pihak sebelum ditandatangani secara resmi.',
      W / 2,
      H - 12,
      { align: 'center', maxWidth: W - 30 }
    )
    doc.setTextColor(120, 135, 165)
    doc.text(`Dibuat ${formatIdDate(new Date())} · Ref: ${refCode}`, W / 2, H - 5, { align: 'center' })

    doc.setTextColor(180, 190, 210)
    doc.setFontSize(7)
    doc.text(`Halaman ${p} / ${pageCount}`, TR, H - 5, { align: 'right' })
  }

  const safeName = (data.organization || data.customerName).replace(/[^a-z0-9]+/gi, '_')
  doc.save(`Kontrak_Lisensi_${safeName}_${refCode}.pdf`)
}
