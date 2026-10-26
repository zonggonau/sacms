import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { SACMS_ICON_WHITE_PNG_BASE64, SACMS_WORDMARK_BLACK_PNG_BASE64 } from "./brand-assets"

// public/assets/img/header-footer-black-email.png is 271x96px
const WORDMARK_ASPECT = 271 / 96

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

  // Grayscale structure throughout — this document is meant to be printed
  // on a home/office printer without burning color toner, so every
  // structural element (table, totals, footer) is a black rule or border
  // on white, never a filled colour band. The two deliberate spots of
  // colour are the real SaCMS logo mark in the header and the payment
  // status (word + total amount) — both small, not fills, cheap on any
  // printer, and both are information a glance at colour genuinely helps
  // with (brand recognition, payment state).
  const BLACK: [number, number, number] = [0, 0, 0]

  /* ═══════════════════════════════════════════════════════════════════════
     1. HEADER — plain, no filled band
  ═══════════════════════════════════════════════════════════════════════ */
  const wordmarkH = 10
  doc.addImage(SACMS_WORDMARK_BLACK_PNG_BASE64, 'PNG', ML, 9, wordmarkH * WORDMARK_ASPECT, wordmarkH)

  rgb(doc, BLACK, 'text')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  rgb(doc, C.slate, 'text')
  doc.text('Enterprise Headless CMS  ·  billing@sacms.cloud  ·  sacms.cloud', ML, 27)

  rgb(doc, BLACK, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('INVOICE', TR, 20, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  rgb(doc, C.slate, 'text')
  doc.text(`No. ${data.orderId}`, TR, 27, { align: 'right' })

  // Double rule under the header — classic formal-document separator,
  // zero ink cost beyond two thin black lines.
  rgb(doc, BLACK, 'draw')
  doc.setLineWidth(0.6)
  doc.line(ML, 33, MR, 33)
  doc.setLineWidth(0.2)
  doc.line(ML, 35.2, MR, 35.2)

  /* ═══════════════════════════════════════════════════════════════════════
     2. META BOXES — bordered only, no fill
  ═══════════════════════════════════════════════════════════════════════ */
  const cardY  = 45
  const cardH  = 36
  const gap    = 6
  const totalW = MR - ML               // 180mm
  const card1W = totalW * 0.58         // ~104mm
  const card2W = totalW - card1W - gap // ~70mm

  rgb(doc, C.border, 'draw')
  doc.setLineWidth(0.3)
  doc.rect(ML,                cardY, card1W, cardH)
  doc.rect(ML + card1W + gap, cardY, card2W, cardH)

  // Box 1 — Billed To
  const c1xi = ML + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  rgb(doc, C.slate, 'text')
  doc.text('TAGIHAN KEPADA', c1xi, cardY + 9)

  rgb(doc, BLACK, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.customerName || 'Customer', c1xi, cardY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  rgb(doc, C.slate, 'text')
  doc.text(data.customerEmail || '-', c1xi, cardY + 26)

  // Box 2 — Invoice Details
  const c2xi  = ML + card1W + gap + 6         // text-left inside box 2
  const c2xr  = ML + card1W + gap + card2W - 6 // text-right inside box 2 (6mm inset)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  rgb(doc, C.slate, 'text')
  doc.text('DETAIL INVOICE', c2xi, cardY + 9)

  const metaRows: [string, string, boolean][] = [
    ['Tanggal',    data.date,   false],
    ['Metode',     data.paymentMethod || 'Midtrans Gateway', false],
    ['Status',     statusLabel, true ],
  ]
  metaRows.forEach(([label, val, isStatus], i) => {
    const ry = cardY + 16 + i * 7.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    rgb(doc, C.slate, 'text')
    doc.text(label, c2xi, ry)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    // Status is the one line allowed a colour — every other value stays
    // plain black, same as the rest of the document.
    rgb(doc, isStatus ? statusColor : BLACK, 'text')
    doc.text(val, c2xr, ry, { align: 'right' })
  })

  /* ═══════════════════════════════════════════════════════════════════════
     3. ITEMS TABLE — ruled lines, no filled header band
  ═══════════════════════════════════════════════════════════════════════ */
  const tableY = cardY + cardH + 10
  const itemDesc = data.description || (data.planName ? `SaCMS — Paket ${data.planName}` : 'SaCMS — Pembayaran / Upgrade Layanan Cloud & AI')

  autoTable(doc, {
    startY: tableY,
    head: [['#', 'Nama Layanan', 'Qty', 'Harga Satuan', 'Jumlah']],
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
      fillColor: [255, 255, 255],
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      overflow: 'visible',
      lineColor: BLACK,
      lineWidth: { bottom: 0.5 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: BLACK,
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
    margin: { left: ML, right: W - MR },
  })

  /* ═══════════════════════════════════════════════════════════════════════
     4. TOTALS BLOCK — bordered box, no filled stripe
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
    rgb(doc, BLACK, 'text')
    doc.text(value, totVX, ty, { align: 'right' })
    ty += 7
  }

  drawSummaryRow('Subtotal (DPP)', fmt(subtotal))
  drawSummaryRow('PPN 11%',        fmt(ppn))

  // Grand total — bordered box instead of a filled colour stripe; the
  // amount itself carries the one status colour (matches the badge above),
  // the label stays plain black.
  rgb(doc, BLACK, 'draw')
  doc.setLineWidth(0.5)
  doc.rect(totLX - 5, ty, totBlockW + 5, 13)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  rgb(doc, BLACK, 'text')
  doc.text('TOTAL PEMBAYARAN', totLX, ty + 8)
  rgb(doc, statusColor, 'text')
  doc.text(fmt(total), totVX, ty + 8, { align: 'right' })
  ty += 19

  /* ═══════════════════════════════════════════════════════════════════════
     5. NOTES — left column, sits beside totals
  ═══════════════════════════════════════════════════════════════════════ */
  const noteY = finalY + 12
  rgb(doc, BLACK, 'text')
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
     6. WATERMARK (PAID / DRAFT / CANCEL) — faint grey, not colour
  ═══════════════════════════════════════════════════════════════════════ */
  doc.saveGraphicsState()
  doc.setGState(new (doc as any).GState({ opacity: 0.07 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(60)
  doc.setTextColor(60, 60, 60)
  if (isPaid) {
    doc.text('LUNAS', W / 2, H / 2, { align: 'center', angle: -35 })
  } else if (isCancelled) {
    doc.text('DIBATALKAN', W / 2, H / 2, { align: 'center', angle: -35 })
  } else {
    doc.text('DRAFT / MENUNGGU', W / 2, H / 2, { align: 'center', angle: -35 })
  }
  doc.restoreGraphicsState()

  /* ═══════════════════════════════════════════════════════════════════════
     7. FOOTER — plain, thin top rule instead of a filled bar
  ═══════════════════════════════════════════════════════════════════════ */
  rgb(doc, BLACK, 'draw')
  doc.setLineWidth(0.4)
  doc.line(ML, H - 20, MR, H - 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  rgb(doc, C.slate, 'text')
  doc.text(
    'Dokumen ini dibuat secara otomatis oleh sistem SaCMS. Tidak memerlukan tanda tangan.',
    W / 2, H - 13, { align: 'center' }
  )
  doc.text(`© ${new Date().getFullYear()} SaCMS, Inc. — www.sacms.cloud`, W / 2, H - 7, { align: 'center' })

  doc.setFontSize(7.5)
  doc.text('Halaman 1 / 1', TR, H - 7, { align: 'right' })

  /* ═══════════════════════════════════════════════════════════════════════
     8. SAVE
  ═══════════════════════════════════════════════════════════════════════ */
  doc.save(`Invoice_${data.orderId}.pdf`)
  return doc
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

const ROMAN_MONTH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const DAY_NAME_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']

/**
 * Generates a formal license/cooperation agreement between SaCMS and the
 * licensee, following the standard Indonesian "Perjanjian Kerja Sama"
 * structure (judul & nomor perjanjian, pembukaan/komparisi, premis/
 * menimbang, pasal-pasal, penutup, tanda tangan, lampiran) rather than a
 * short ad-hoc letter. Populated from the EnterpriseLicense record. SaCMS's
 * own legal-entity particulars (alamat resmi, NPWP) aren't captured
 * anywhere in this system, so those are left as explicit bracketed
 * placeholders for the legal team to fill in rather than fabricated — this
 * is a base document meant for legal review before signing, not a final
 * lawyer-drafted contract, and is labelled as such throughout.
 */
export function generateLicenseContractPDF(data: LicenseContractData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const H = 297
  // Generous 20mm side margins (wider than a typical invoice) — closer to
  // the margin convention Indonesian formal/legal documents use.
  const ML = 20
  const MR = 190
  const TR = 185
  const bodyWidth = MR - ML

  const typeLabel = TYPE_LABEL[data.type] || data.type
  const refCode = data.displayKey || data.licenseId.slice(0, 10)
  const issuedDate = new Date(data.issuedAt)
  const totalDays = Math.max(
    0,
    Math.round((new Date(data.expiresAt).getTime() - issuedDate.getTime()) / 86400000)
  )
  const agreementNo = `${refCode}/PKS-SACMS/${ROMAN_MONTH[issuedDate.getMonth()]}/${issuedDate.getFullYear()}`
  const partyTwoName = data.organization || data.customerName

  /* ═══ 0. COVER PAGE ═══ */
  rgb(doc, C.navy, 'fill')
  doc.rect(0, 0, W, H, 'F')
  rgb(doc, C.blue, 'fill')
  doc.rect(0, 0, W, 4, 'F')
  doc.rect(0, H - 4, W, 4, 'F')

  doc.addImage(SACMS_ICON_WHITE_PNG_BASE64, 'PNG', W / 2 - 8, 26, 16, 16)

  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('SaCMS', W / 2, 52, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 190, 210)
  doc.text('Enterprise Headless CMS', W / 2, 60, { align: 'center' })

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(W / 2 - 28, 70, W / 2 + 28, 70)

  rgb(doc, C.white, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(23)
  doc.text('PERJANJIAN KERJA SAMA', W / 2, 112, { align: 'center' })
  doc.setFontSize(15)
  doc.text(doc.splitTextToSize('LISENSI PENGGUNAAN PERANGKAT LUNAK SACMS', W - 70), W / 2, 127, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 190, 210)
  doc.text(`Nomor: ${agreementNo}`, W / 2, 142, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  rgb(doc, C.white, 'text')
  doc.text('ANTARA', W / 2, 168, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('SaCMS, Inc.', W / 2, 181, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 210)
  doc.text('("PIHAK PERTAMA")', W / 2, 187, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  rgb(doc, C.white, 'text')
  doc.text('DAN', W / 2, 200, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(partyTwoName, W / 2, 213, { align: 'center', maxWidth: W - 60 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 210)
  doc.text('("PIHAK KEDUA")', W / 2, 222, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 210, 225)
  doc.text(`Nabire, ${formatIdDate(issuedDate)}`, W / 2, H - 34, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(150, 165, 190)
  doc.text(
    'Dokumen ini adalah draf dasar — tinjau bersama tim legal kedua pihak sebelum ditandatangani secara resmi.',
    W / 2, H - 20, { align: 'center', maxWidth: W - 60 }
  )

  doc.addPage()

  let y = 0
  const ensureSpace = (needed: number) => {
    if (y + needed > H - 26) {
      doc.addPage()
      y = 20
    }
  }

  /* ═══ HEADER BAND — compact running head on every content page. The big
     brand/title treatment lives on the cover page instead (drawn above),
     so every content page after it only needs this short strip. ═══ */
  const drawHeaderBand = () => {
    const bandH = 16
    rgb(doc, C.navy, 'fill')
    doc.rect(0, 0, W, bandH, 'F')
    rgb(doc, C.blue, 'fill')
    doc.rect(0, bandH, W, 2, 'F')

    doc.addImage(SACMS_ICON_WHITE_PNG_BASE64, 'PNG', ML, 4, 8, 8)

    rgb(doc, C.white, 'text')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('SaCMS — Perjanjian Kerja Sama Lisensi Perangkat Lunak', ML + 10, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 190, 210)
    doc.text(`No: ${agreementNo}`, TR, 10, { align: 'right' })
    return bandH + 2
  }

  // Compact running header, not the big cover treatment — the cover page
  // already carries the full title, so repeating it here would be redundant.
  y = drawHeaderBand() + 10

  /* ═══ TEXT HELPERS ═══ */
  // 0.62 line-height multiplier (rather than a tighter ~0.55) so a clause
  // that wraps across several lines still reads as separated lines, not a
  // solid block — this is the main fix for "paragraf terlalu panjang,
  // tolong di-enter agar rapih".
  const LINE_HEIGHT = 0.62
  const drawParagraph = (text: string, opts: { size?: number; bold?: boolean; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 12
    const indent = opts.indent ?? 0
    // Font/size MUST be set before splitTextToSize — it measures using
    // whatever font is currently active, not the one about to be drawn
    // with. Measuring at the previous call's (often smaller) size let
    // lines run wider than bodyWidth once actually rendered at this
    // call's size, overflowing past the right margin.
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, bodyWidth - indent)
    ensureSpace(lines.length * (size * LINE_HEIGHT) + 2)
    rgb(doc, C.dark, 'text')
    doc.text(lines, ML + indent, y)
    y += lines.length * (size * LINE_HEIGHT) + (opts.gap ?? 4)
  }

  /** Borderless label/value table — keeps the colon column aligned across
   *  rows (what manually padded strings like "Nama  : SaCMS, Inc." tried
   *  and failed to do consistently) for party-identity blocks. */
  const drawLabelValueTable = (rows: [string, string][], indent = 4) => {
    ensureSpace(rows.length * 8 + 4)
    autoTable(doc, {
      startY: y,
      body: rows.map(([label, value]) => [label, ':', value]),
      theme: 'plain',
      styles: { fontSize: 12, textColor: C.dark, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 1.5 } },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 5 },
        2: { cellWidth: bodyWidth - indent - 57 },
      },
      margin: { left: ML + indent, right: W - MR },
      tableWidth: bodyWidth - indent,
    })
    y = ((doc as any).lastAutoTable?.finalY ?? y + rows.length * 8) + 2
  }

  const drawSectionTitle = (text: string) => {
    ensureSpace(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    rgb(doc, C.navy, 'text')
    doc.text(text, W / 2, y, { align: 'center' })
    y += 11
  }

  const drawArticle = (title: string, bodyLines: string[]) => {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    rgb(doc, C.navy, 'text')
    doc.text(title, W / 2, y, { align: 'center' })
    y += 10
    // gap: 5 between each numbered clause — clearly separated lines rather
    // than one dense block, since each is its own legal point.
    bodyLines.forEach((b) => drawParagraph(b, { indent: 4, gap: 5 }))
    y += 5
  }

  /* ═══ 1. PEMBUKAAN / KOMPARISI ═══ */
  const dayName = DAY_NAME_ID[issuedDate.getDay()]
  drawParagraph(
    `Pada hari ini, ${dayName}, tanggal ${formatIdDate(issuedDate)}, bertempat di Nabire, Papua Tengah, yang bertanda tangan di bawah ini masing-masing:`,
    { gap: 5 }
  )

  drawParagraph('1. PIHAK PERTAMA', { bold: true, gap: 2 })
  drawLabelValueTable([
    ['Nama Badan Usaha', 'SaCMS, Inc.'],
    ['Alamat', '[Diisi oleh Tim Legal SaCMS]'],
    ['NPWP', '[Diisi oleh Tim Legal SaCMS]'],
    ['Email Resmi', 'legal@sacms.cloud'],
  ])
  drawParagraph(
    'Dalam hal ini bertindak untuk dan atas nama serta sah mewakili SaCMS, selanjutnya disebut sebagai "PIHAK PERTAMA".',
    { indent: 4, gap: 5 }
  )

  drawParagraph('2. PIHAK KEDUA', { bold: true, gap: 2 })
  drawLabelValueTable([
    ['Nama', data.customerName],
    ['Instansi / Organisasi', partyTwoName],
    ['Alamat', '[Diisi oleh Pelanggan]'],
    ['NPWP', '[Diisi oleh Pelanggan]'],
    ['Email Kontak', data.customerEmail || '[Diisi oleh Pelanggan]'],
  ])
  drawParagraph(
    `Dalam hal ini bertindak untuk dan atas nama serta sah mewakili ${partyTwoName}, selanjutnya disebut sebagai "PIHAK KEDUA".`,
    { indent: 4, gap: 6 }
  )

  drawParagraph('PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama selanjutnya disebut "PARA PIHAK".', { gap: 6 })

  /* ═══ 2. PREMIS / MENIMBANG ═══ */
  drawParagraph(
    'PARA PIHAK terlebih dahulu menerangkan hal-hal sebagai berikut:',
    { gap: 3 }
  )
  drawParagraph(
    'a. bahwa PIHAK PERTAMA adalah badan usaha yang bergerak dalam penyediaan platform Content Management System berbasis Software-as-a-Service bernama SaCMS;',
    { indent: 4, gap: 5 }
  )
  drawParagraph(
    'b. bahwa PIHAK KEDUA bermaksud menggunakan Perangkat Lunak tersebut untuk kebutuhan internal instansi/organisasinya;',
    { indent: 4, gap: 5 }
  )
  drawParagraph(
    'c. bahwa berdasarkan hal-hal tersebut di atas, PARA PIHAK sepakat untuk mengadakan Perjanjian Kerja Sama Lisensi Penggunaan Perangkat Lunak ("Perjanjian") dengan syarat dan ketentuan sebagai berikut:',
    { indent: 4, gap: 6 }
  )

  /* ═══ 3. PASAL-PASAL ═══ */
  drawSectionTitle('ISI PERJANJIAN')

  drawArticle('Pasal 1 — Definisi', [
    '1. "Perangkat Lunak" adalah platform Content Management System berbasis Software-as-a-Service bernama SaCMS beserta seluruh fitur, modul, dan layanan pendukungnya yang disediakan oleh PIHAK PERTAMA.',
    '2. "Lisensi" adalah hak penggunaan terbatas atas Perangkat Lunak yang diberikan PIHAK PERTAMA kepada PIHAK KEDUA berdasarkan Perjanjian ini, dibuktikan dengan kunci lisensi (license key) yang bersifat rahasia dan tidak dapat dialihkan.',
    '3. "Kuota Layanan" adalah batasan jumlah ruang kerja (workspace), kapasitas penyimpanan (storage), dan kredit kecerdasan buatan (AI credits) yang diberikan kepada PIHAK KEDUA sebagaimana diatur dalam Lampiran A Perjanjian ini.',
    '4. "Masa Berlaku" adalah jangka waktu keberlakuan Lisensi sebagaimana diatur dalam Pasal 5 Perjanjian ini.',
  ])

  drawArticle('Pasal 2 — Objek dan Ruang Lingkup Perjanjian', [
    '1. PIHAK PERTAMA dengan ini memberikan Lisensi penggunaan Perangkat Lunak kepada PIHAK KEDUA sesuai dengan Kuota Layanan yang tercantum dalam Lampiran A Perjanjian ini.',
    '2. Kuota Layanan ditegakkan secara otomatis oleh sistem; setiap pembuatan ruang kerja (workspace), penggunaan kapasitas penyimpanan, atau kredit kecerdasan buatan di luar Kuota Layanan akan ditolak oleh sistem sampai PIHAK KEDUA menambah Kuota Layanan melalui PIHAK PERTAMA.',
    '3. Lisensi ini bersifat non-eksklusif dan hanya berlaku untuk 1 (satu) akun PIHAK KEDUA sebagaimana diatur lebih lanjut dalam Pasal 4 Perjanjian ini.',
  ])

  drawArticle('Pasal 3 — Hak dan Kewajiban PIHAK PERTAMA', [
    '1. PIHAK PERTAMA berhak menerima pembayaran Nilai Kontrak sebagaimana diatur dalam Pasal 6 Perjanjian ini.',
    '2. PIHAK PERTAMA berkewajiban menyediakan akses Perangkat Lunak sesuai Kuota Layanan selama Masa Berlaku.',
    '3. PIHAK PERTAMA berhak mencabut atau menangguhkan Lisensi apabila PIHAK KEDUA terbukti melanggar ketentuan Pasal 7 Perjanjian ini.',
  ])

  drawArticle('Pasal 4 — Hak dan Kewajiban PIHAK KEDUA', [
    '1. PIHAK KEDUA berhak menggunakan Perangkat Lunak sesuai Kuota Layanan selama Masa Berlaku.',
    '2. PIHAK KEDUA berkewajiban menjaga kerahasiaan kunci lisensi (license key) yang diterbitkan untuknya dan hanya mengaktifkannya pada 1 (satu) akun miliknya sendiri.',
    '3. PIHAK KEDUA tidak diperkenankan melakukan rekayasa balik (reverse engineering), modifikasi, duplikasi, maupun pengalihan Lisensi kepada pihak lain tanpa persetujuan tertulis dari PIHAK PERTAMA.',
  ])

  drawArticle('Pasal 5 — Jangka Waktu dan Pengakhiran', [
    '1. Perjanjian ini berlaku sejak Tanggal Mulai hingga Tanggal Berakhir sebagaimana tercantum dalam Lampiran A Perjanjian ini.',
    '2. Apabila Lisensi tidak diperpanjang sebelum Tanggal Berakhir, sistem akan mengunci akses secara otomatis (hard lockout) dan PIHAK KEDUA tidak dapat membuka kunci tersebut secara mandiri; akses hanya dapat dibuka kembali melalui penerbitan Lisensi baru oleh PIHAK PERTAMA.',
    '3. Perjanjian ini dapat diperpanjang berdasarkan kesepakatan tertulis PARA PIHAK sebelum berakhirnya Masa Berlaku.',
  ])

  drawArticle('Pasal 6 — Nilai Kontrak dan Cara Pembayaran', [
    data.priceIdr != null
      ? `1. Nilai kontrak Perjanjian ini disepakati sebesar ${formatRupiahPdf(data.priceIdr)} untuk Masa Berlaku ${totalDays} hari sebagaimana tercantum dalam Lampiran A Perjanjian ini.`
      : '1. Nilai kontrak Perjanjian ini disepakati sebesar Rp ___________________________ untuk Masa Berlaku sebagaimana tercantum dalam Lampiran A Perjanjian ini.',
    '2. Cara, jadwal, dan mekanisme pembayaran diatur lebih lanjut dalam lampiran/addendum tersendiri yang disepakati secara tertulis oleh PARA PIHAK.',
  ])

  drawArticle('Pasal 7 — Kerahasiaan dan Perlindungan Data', [
    '1. PARA PIHAK sepakat untuk menjaga kerahasiaan seluruh informasi, data, dan dokumen yang diperoleh sehubungan dengan Perjanjian ini.',
    '2. PIHAK PERTAMA berkomitmen untuk memproses data yang dikelola melalui Perangkat Lunak sesuai dengan prinsip pelindungan data pribadi sebagaimana diatur dalam Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
  ])

  drawArticle('Pasal 8 — Keadaan Memaksa (Force Majeure)', [
    'PARA PIHAK dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pelaksanaan Perjanjian ini apabila disebabkan oleh keadaan memaksa (force majeure), termasuk namun tidak terbatas pada bencana alam, kebijakan pemerintah, gangguan jaringan internet berskala nasional, atau peristiwa lain di luar kendali wajar PARA PIHAK.',
  ])

  drawArticle('Pasal 9 — Penyelesaian Perselisihan', [
    'Setiap perselisihan yang timbul dari Perjanjian ini akan diselesaikan terlebih dahulu secara musyawarah untuk mencapai mufakat. Apabila musyawarah tidak mencapai kesepakatan dalam waktu 30 (tiga puluh) hari kalender, PARA PIHAK sepakat untuk menyelesaikannya melalui domisili hukum yang akan ditentukan dalam addendum Perjanjian ini.',
  ])

  drawArticle('Pasal 10 — Lain-lain', [
    '1. Hal-hal yang belum atau belum cukup diatur dalam Perjanjian ini akan diatur lebih lanjut dalam addendum yang disepakati bersama secara tertulis oleh PARA PIHAK dan merupakan bagian yang tidak terpisahkan dari Perjanjian ini.',
    '2. Apabila terdapat ketentuan dalam Perjanjian ini yang dinyatakan tidak sah atau tidak dapat dilaksanakan, ketentuan lainnya tetap berlaku dan mengikat PARA PIHAK.',
  ])

  /* ═══ 4. PENUTUP ═══ */
  drawParagraph(
    'Demikian Perjanjian ini dibuat dalam 2 (dua) rangkap asli bermaterai cukup, masing-masing mempunyai kekuatan hukum yang sama, dan ditandatangani oleh PARA PIHAK pada hari dan tanggal sebagaimana tersebut di atas tanpa ada tekanan dari pihak mana pun.',
    { gap: 10 }
  )

  /* ═══ 5. TANDA TANGAN ═══ */
  ensureSpace(60)
  const sigColW = bodyWidth / 2
  const sig1X = ML
  const sig2X = ML + sigColW

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  rgb(doc, C.dark, 'text')
  doc.text('PIHAK PERTAMA,', sig1X, y)
  doc.text('PIHAK KEDUA,', sig2X, y)

  const materaiY = y + 9
  rgb(doc, C.border, 'draw')
  doc.setLineWidth(0.2)
  doc.setLineDashPattern([1, 1], 0)
  doc.rect(sig1X, materaiY, 22, 14)
  doc.rect(sig2X, materaiY, 22, 14)
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  rgb(doc, C.slate, 'text')
  doc.text('Materai', sig1X + 11, materaiY + 8, { align: 'center' })
  doc.text('Materai', sig2X + 11, materaiY + 8, { align: 'center' })

  const lineY = materaiY + 26
  doc.setDrawColor(C.dark[0], C.dark[1], C.dark[2])
  doc.setLineWidth(0.2)
  doc.line(sig1X, lineY, sig1X + 60, lineY)
  doc.line(sig2X, lineY, sig2X + 60, lineY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  rgb(doc, C.dark, 'text')
  doc.text('SaCMS, Inc.', sig1X, lineY + 6)
  doc.text(partyTwoName, sig2X, lineY + 6, { maxWidth: sigColW - 6 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  rgb(doc, C.slate, 'text')
  doc.text('Nama & Jabatan', sig1X, lineY + 13)
  doc.text('Nama & Jabatan', sig2X, lineY + 13)

  /* ═══ 6. LAMPIRAN A — on its own page ═══ */
  doc.addPage()
  y = drawHeaderBand() + 10

  drawSectionTitle('LAMPIRAN A')
  drawParagraph('Spesifikasi Teknis dan Kuota Layanan', { bold: true, gap: 2 })
  drawParagraph(
    'Lampiran ini merupakan bagian yang tidak terpisahkan dari Perjanjian Kerja Sama Lisensi Penggunaan Perangkat Lunak SaCMS.',
    { gap: 6 }
  )

  autoTable(doc, {
    startY: y,
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
      fontSize: 12,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 12,
      textColor: C.dark,
      cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      lineColor: C.border,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: bodyWidth - 70 },
    },
    alternateRowStyles: { fillColor: C.light },
    margin: { left: ML, right: W - MR },
  })
  y = ((doc as any).lastAutoTable?.finalY ?? y + 80) + 6
  drawParagraph(
    'Perubahan atas Kuota Layanan dan/atau Nilai Kontrak dapat dilakukan melalui addendum tertulis yang disepakati PARA PIHAK, tanpa perlu menerbitkan ulang Perjanjian ini secara keseluruhan.',
    { gap: 2 }
  )

  /* ═══ 7. FOOTER BAR (every page except the cover) ═══ */
  const pageCount = doc.getNumberOfPages()
  for (let p = 2; p <= pageCount; p++) {
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
    doc.text(`Dibuat ${formatIdDate(new Date())} · No: ${agreementNo}`, W / 2, H - 5, { align: 'center' })

    doc.setTextColor(180, 190, 210)
    doc.setFontSize(7)
    doc.text(`Halaman ${p - 1} / ${pageCount - 1}`, TR, H - 5, { align: 'right' })
  }

  const safeName = partyTwoName.replace(/[^a-z0-9]+/gi, '_')
  doc.save(`Kontrak_Lisensi_${safeName}_${refCode}.pdf`)
  return doc
}
