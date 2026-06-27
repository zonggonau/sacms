import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface InvoiceData {
  orderId: string
  amount: number
  status: string
  date: string
  customerName?: string
  customerEmail?: string
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

  const isPaid    = data.status.toLowerCase() === 'success'
  const isPending = data.status.toLowerCase() === 'pending'
  const statusLabel = isPaid ? 'LUNAS' : isPending ? 'MENUNGGU' : 'GAGAL'
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
  doc.text('Headless CMS Platform  ·  hello@sacms.com  ·  www.sacms.com', ML, 29)

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
    ['Jatuh Tempo', data.date,  false],
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
     Column widths must sum to MR - ML = 180mm
     #=16, Desc=78, Qty=18, Harga Satuan=36, Jumlah=32  → total = 180 ✓
     Padding reduced to 4mm each side so narrow cols never wrap.
  ═══════════════════════════════════════════════════════════════════════ */
  const tableY = cardY + cardH + 10

  autoTable(doc, {
    startY: tableY,
    head: [['#', 'Deskripsi Layanan', 'Qty', 'Harga Satuan', 'Jumlah']],
    body: [
      [
        '01',
        'SaCMS — Pembayaran / Upgrade Paket Langganan',
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
  rgb(doc, C.blue, 'fill')
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
    '• Pembayaran diproses melalui gateway Midtrans.',
    '• Simpan invoice ini sebagai bukti pembayaran yang sah.',
    '• Pertanyaan tagihan: billing@sacms.com',
  ]
  notes.forEach((n, i) => doc.text(n, ML, noteY + 8 + i * 7))

  /* ═══════════════════════════════════════════════════════════════════════
     7. WATERMARK "LUNAS"
  ═══════════════════════════════════════════════════════════════════════ */
  if (isPaid) {
    doc.saveGraphicsState()
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(70)
    doc.setTextColor(21, 128, 61)
    doc.text('LUNAS', W / 2, H / 2, { align: 'center', angle: -35 })
    doc.restoreGraphicsState()
  }

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
