import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'

interface InvoiceLineItem {
  displayName: string
  displayDescription?: string | null
  categoryName?: string | null
  roomName?: string | null
  quantity: number
  unitType?: string | null
  clientUnitPrice: number
  clientTotalPrice: number
}

interface InvoiceData {
  invoiceNumber: string
  createdAt: Date
  validUntil?: Date | null

  // Client info
  clientName: string
  clientEmail?: string | null
  clientPhone?: string | null
  clientAddress?: string | null

  // Project info
  projectName: string

  // Line items
  lineItems: InvoiceLineItem[]

  // Pricing
  subtotal: number
  gstRate: number
  gstAmount: number
  qstRate: number
  qstAmount: number
  totalAmount: number

  // Payment info
  paymentTerms?: string | null
  depositRequired?: number | null
  depositAmount?: number | null
  paymentSchedule?: { label: string; percent: number }[] | null
}

interface OrganizationData {
  name: string
  logoUrl?: string | null
  businessName?: string | null
  businessAddress?: string | null
  businessCity?: string | null
  businessProvince?: string | null
  businessPostal?: string | null
  businessCountry?: string | null
  businessPhone?: string | null
  businessEmail?: string | null
  neqNumber?: string | null
  gstNumber?: string | null
  qstNumber?: string | null
  wireInstructions?: string | null
  checkInstructions?: string | null
  etransferEmail?: string | null
}

// Color scheme
const COLORS = {
  primary: rgb(0.2, 0.2, 0.2),      // Dark gray for text
  secondary: rgb(0.4, 0.4, 0.4),    // Medium gray
  light: rgb(0.6, 0.6, 0.6),        // Light gray
  accent: rgb(0.15, 0.35, 0.55),    // Blue accent
  white: rgb(1, 1, 1),
  tableHeader: rgb(0.93, 0.93, 0.93), // Light gray background
  tableBorder: rgb(0.8, 0.8, 0.8),
}

const PAGE_MARGIN = 50
const LINE_HEIGHT = 14
const SECTION_GAP = 20

/**
 * Generate a professional PDF invoice
 */
export async function generateInvoicePdf(
  invoice: InvoiceData,
  organization: OrganizationData
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Create first page
  let page = pdfDoc.addPage([612, 792]) // Letter size
  const { width, height } = page.getSize()

  let yPos = height - PAGE_MARGIN

  // === HEADER SECTION ===
  yPos = drawHeader(page, organization, invoice, helvetica, helveticaBold, yPos, width)

  // === CLIENT SECTION ===
  yPos -= SECTION_GAP
  yPos = drawClientSection(page, invoice, helvetica, helveticaBold, yPos)

  // === LINE ITEMS TABLE ===
  yPos -= SECTION_GAP
  const result = drawLineItemsTable(pdfDoc, page, invoice.lineItems, helvetica, helveticaBold, yPos, width)
  page = result.page
  yPos = result.yPos

  // === TOTALS SECTION ===
  yPos -= SECTION_GAP
  yPos = drawTotals(page, invoice, helvetica, helveticaBold, yPos, width)

  // === PAYMENT INSTRUCTIONS ===
  if (organization.wireInstructions || organization.etransferEmail || organization.checkInstructions) {
    yPos -= SECTION_GAP

    // Check if we need a new page
    if (yPos < 200) {
      page = pdfDoc.addPage([612, 792])
      yPos = height - PAGE_MARGIN
    }

    yPos = drawPaymentInstructions(page, organization, helvetica, helveticaBold, yPos)
  }

  // === FOOTER ===
  drawFooter(page, organization, helvetica, width)

  // Serialize to bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function drawHeader(
  page: PDFPage,
  org: OrganizationData,
  invoice: InvoiceData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number,
  width: number
): number {
  // Company name (large, bold)
  const companyName = org.businessName || org.name
  page.drawText(companyName, {
    x: PAGE_MARGIN,
    y: yPos,
    size: 20,
    font: boldFont,
    color: COLORS.primary,
  })

  // INVOICE title (right aligned)
  const invoiceTitle = 'INVOICE'
  const titleWidth = boldFont.widthOfTextAtSize(invoiceTitle, 24)
  page.drawText(invoiceTitle, {
    x: width - PAGE_MARGIN - titleWidth,
    y: yPos,
    size: 24,
    font: boldFont,
    color: COLORS.accent,
  })

  yPos -= 20

  // Company address
  const addressParts: string[] = []
  if (org.businessAddress) addressParts.push(org.businessAddress)
  if (org.businessCity || org.businessProvince || org.businessPostal) {
    const cityLine = [org.businessCity, org.businessProvince, org.businessPostal].filter(Boolean).join(', ')
    if (cityLine) addressParts.push(cityLine)
  }
  if (org.businessCountry) addressParts.push(org.businessCountry)

  for (const line of addressParts) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 9,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Company contact
  if (org.businessPhone) {
    page.drawText(`Tel: ${org.businessPhone}`, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 9,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  if (org.businessEmail) {
    page.drawText(`Email: ${org.businessEmail}`, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 9,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Invoice details (right side)
  const rightX = width - PAGE_MARGIN - 150
  let rightY = yPos + (addressParts.length * LINE_HEIGHT) + LINE_HEIGHT

  // Invoice number
  page.drawText('Invoice #:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  page.drawText(invoice.invoiceNumber, {
    x: rightX + 70,
    y: rightY,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  rightY -= LINE_HEIGHT

  // Date
  const dateStr = formatDate(invoice.createdAt)
  page.drawText('Date:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  page.drawText(dateStr, {
    x: rightX + 70,
    y: rightY,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  rightY -= LINE_HEIGHT

  // Due date
  if (invoice.validUntil) {
    const dueStr = formatDate(invoice.validUntil)
    page.drawText('Due Date:', {
      x: rightX,
      y: rightY,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    })
    page.drawText(dueStr, {
      x: rightX + 70,
      y: rightY,
      size: 10,
      font: font,
      color: COLORS.primary,
    })
    rightY -= LINE_HEIGHT
  }

  // Project
  page.drawText('Project:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })

  // Truncate project name if too long
  let projectName = invoice.projectName
  if (font.widthOfTextAtSize(projectName, 10) > 80) {
    while (font.widthOfTextAtSize(projectName + '...', 10) > 80 && projectName.length > 0) {
      projectName = projectName.slice(0, -1)
    }
    projectName += '...'
  }

  page.drawText(projectName, {
    x: rightX + 70,
    y: rightY,
    size: 10,
    font: font,
    color: COLORS.primary,
  })

  // Draw separator line
  yPos -= 10
  page.drawLine({
    start: { x: PAGE_MARGIN, y: yPos },
    end: { x: width - PAGE_MARGIN, y: yPos },
    thickness: 1,
    color: COLORS.tableBorder,
  })

  return yPos
}

function drawClientSection(
  page: PDFPage,
  invoice: InvoiceData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number
): number {
  // Bill To header
  page.drawText('BILL TO:', {
    x: PAGE_MARGIN,
    y: yPos,
    size: 10,
    font: boldFont,
    color: COLORS.accent,
  })
  yPos -= LINE_HEIGHT + 2

  // Client name
  page.drawText(invoice.clientName, {
    x: PAGE_MARGIN,
    y: yPos,
    size: 11,
    font: boldFont,
    color: COLORS.primary,
  })
  yPos -= LINE_HEIGHT

  // Client address
  if (invoice.clientAddress) {
    const addressLines = invoice.clientAddress.split('\n')
    for (const line of addressLines) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
  }

  // Client email
  if (invoice.clientEmail) {
    page.drawText(invoice.clientEmail, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Client phone
  if (invoice.clientPhone) {
    page.drawText(invoice.clientPhone, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  return yPos
}

function drawLineItemsTable(
  pdfDoc: PDFDocument,
  page: PDFPage,
  items: InvoiceLineItem[],
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number,
  width: number
): { page: PDFPage; yPos: number } {
  const tableWidth = width - (2 * PAGE_MARGIN)
  const colWidths = {
    item: tableWidth * 0.45,
    qty: tableWidth * 0.12,
    unit: tableWidth * 0.18,
    total: tableWidth * 0.25,
  }

  const rowHeight = 22
  // headerY is used for calculating offsets but not directly referenced

  // Table header background
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: yPos - rowHeight + 5,
    width: tableWidth,
    height: rowHeight,
    color: COLORS.tableHeader,
  })

  // Header text
  const headerTextY = yPos - 12
  let xPos = PAGE_MARGIN + 5

  page.drawText('Description', {
    x: xPos,
    y: headerTextY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  xPos += colWidths.item

  page.drawText('Qty', {
    x: xPos,
    y: headerTextY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  xPos += colWidths.qty

  page.drawText('Unit Price', {
    x: xPos,
    y: headerTextY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  xPos += colWidths.unit

  // Right-align Total header
  const totalHeaderWidth = boldFont.widthOfTextAtSize('Total', 10)
  page.drawText('Total', {
    x: width - PAGE_MARGIN - totalHeaderWidth - 5,
    y: headerTextY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })

  yPos -= rowHeight

  // Draw items
  for (const item of items) {
    // Check if we need a new page
    if (yPos < 150) {
      page = pdfDoc.addPage([612, 792])
      yPos = 792 - PAGE_MARGIN
    }

    const itemRowHeight = 18
    const textY = yPos - 13
    xPos = PAGE_MARGIN + 5

    // Item name (truncate if needed)
    let itemName = item.displayName
    const maxItemWidth = colWidths.item - 10
    if (font.widthOfTextAtSize(itemName, 9) > maxItemWidth) {
      while (font.widthOfTextAtSize(itemName + '...', 9) > maxItemWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
      }
      itemName += '...'
    }

    page.drawText(itemName, {
      x: xPos,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })
    xPos += colWidths.item

    // Quantity
    page.drawText(`${item.quantity}`, {
      x: xPos,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })
    xPos += colWidths.qty

    // Unit price
    page.drawText(formatCurrency(item.clientUnitPrice), {
      x: xPos,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })

    // Total (right-aligned)
    const totalText = formatCurrency(item.clientTotalPrice)
    const totalWidth = font.widthOfTextAtSize(totalText, 9)
    page.drawText(totalText, {
      x: width - PAGE_MARGIN - totalWidth - 5,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })

    yPos -= itemRowHeight

    // Draw light separator line
    page.drawLine({
      start: { x: PAGE_MARGIN, y: yPos },
      end: { x: width - PAGE_MARGIN, y: yPos },
      thickness: 0.5,
      color: COLORS.tableBorder,
    })
  }

  return { page, yPos }
}

function drawTotals(
  page: PDFPage,
  invoice: InvoiceData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number,
  width: number
): number {
  const rightX = width - PAGE_MARGIN - 150
  const valueX = width - PAGE_MARGIN - 5

  // Subtotal
  page.drawText('Subtotal:', {
    x: rightX,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  const subtotalText = formatCurrency(invoice.subtotal)
  const subtotalWidth = font.widthOfTextAtSize(subtotalText, 10)
  page.drawText(subtotalText, {
    x: valueX - subtotalWidth,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  yPos -= LINE_HEIGHT

  // GST
  page.drawText(`GST (${invoice.gstRate}%):`, {
    x: rightX,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.secondary,
  })
  const gstText = formatCurrency(invoice.gstAmount)
  const gstWidth = font.widthOfTextAtSize(gstText, 10)
  page.drawText(gstText, {
    x: valueX - gstWidth,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.secondary,
  })
  yPos -= LINE_HEIGHT

  // QST
  page.drawText(`QST (${invoice.qstRate}%):`, {
    x: rightX,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.secondary,
  })
  const qstText = formatCurrency(invoice.qstAmount)
  const qstWidth = font.widthOfTextAtSize(qstText, 10)
  page.drawText(qstText, {
    x: valueX - qstWidth,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.secondary,
  })
  yPos -= LINE_HEIGHT + 5

  // Draw line before total
  page.drawLine({
    start: { x: rightX - 10, y: yPos + 3 },
    end: { x: width - PAGE_MARGIN, y: yPos + 3 },
    thickness: 1,
    color: COLORS.tableBorder,
  })

  // Total (bold)
  page.drawText('TOTAL:', {
    x: rightX,
    y: yPos - 5,
    size: 12,
    font: boldFont,
    color: COLORS.primary,
  })
  const totalText = formatCurrency(invoice.totalAmount)
  const totalWidth = boldFont.widthOfTextAtSize(totalText, 12)
  page.drawText(totalText, {
    x: valueX - totalWidth,
    y: yPos - 5,
    size: 12,
    font: boldFont,
    color: COLORS.accent,
  })
  yPos -= LINE_HEIGHT + 10

  // Payment schedule breakdown
  if (invoice.paymentSchedule && invoice.paymentSchedule.length > 0) {
    yPos -= 5
    page.drawText('PAYMENT SCHEDULE', {
      x: rightX,
      y: yPos,
      size: 9,
      font: boldFont,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
    for (const milestone of invoice.paymentSchedule) {
      const milestoneAmount = Math.round(invoice.totalAmount * milestone.percent / 100 * 100) / 100
      const label = `${milestone.label || 'Payment'} (${milestone.percent}%):`
      page.drawText(label, {
        x: rightX,
        y: yPos,
        size: 9,
        font: font,
        color: COLORS.primary,
      })
      const amountText = formatCurrency(milestoneAmount)
      const amountWidth = font.widthOfTextAtSize(amountText, 9)
      page.drawText(amountText, {
        x: valueX - amountWidth,
        y: yPos,
        size: 9,
        font: font,
        color: COLORS.primary,
      })
      yPos -= LINE_HEIGHT
    }
  } else if (invoice.depositRequired && invoice.depositAmount) {
    // Fallback: simple deposit display for legacy invoices
    yPos -= 5
    page.drawText(`Deposit Required (${invoice.depositRequired}%):`, {
      x: rightX,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.primary,
    })
    const depositText = formatCurrency(invoice.depositAmount)
    const depositWidth = font.widthOfTextAtSize(depositText, 10)
    page.drawText(depositText, {
      x: valueX - depositWidth,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.primary,
    })
    yPos -= LINE_HEIGHT
  }

  return yPos
}

function drawPaymentInstructions(
  page: PDFPage,
  org: OrganizationData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number
): number {
  // Section header
  page.drawText('PAYMENT INSTRUCTIONS', {
    x: PAGE_MARGIN,
    y: yPos,
    size: 11,
    font: boldFont,
    color: COLORS.accent,
  })
  yPos -= LINE_HEIGHT + 5

  // E-Transfer
  if (org.etransferEmail) {
    page.drawText('Interac e-Transfer:', {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    })
    yPos -= LINE_HEIGHT
    page.drawText(`Send to: ${org.etransferEmail}`, {
      x: PAGE_MARGIN + 10,
      y: yPos,
      size: 9,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT + 5
  }

  // Wire transfer
  if (org.wireInstructions) {
    page.drawText('Wire Transfer:', {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    })
    yPos -= LINE_HEIGHT

    const wireLines = org.wireInstructions.split('\n')
    for (const line of wireLines.slice(0, 6)) { // Limit to 6 lines
      page.drawText(line, {
        x: PAGE_MARGIN + 10,
        y: yPos,
        size: 9,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
    yPos -= 5
  }

  // Check
  if (org.checkInstructions) {
    page.drawText('By Check:', {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    })
    yPos -= LINE_HEIGHT

    const checkLines = org.checkInstructions.split('\n')
    for (const line of checkLines.slice(0, 4)) { // Limit to 4 lines
      page.drawText(line, {
        x: PAGE_MARGIN + 10,
        y: yPos,
        size: 9,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
  }

  // Tax numbers
  yPos -= 10
  const taxNumbers: string[] = []
  if (org.gstNumber) taxNumbers.push(`GST# ${org.gstNumber}`)
  if (org.qstNumber) taxNumbers.push(`QST# ${org.qstNumber}`)
  if (org.neqNumber) taxNumbers.push(`NEQ# ${org.neqNumber}`)

  if (taxNumbers.length > 0) {
    page.drawText(taxNumbers.join('   |   '), {
      x: PAGE_MARGIN,
      y: yPos,
      size: 8,
      font: font,
      color: COLORS.light,
    })
    yPos -= LINE_HEIGHT
  }

  return yPos
}

function drawFooter(
  page: PDFPage,
  org: OrganizationData,
  font: PDFFont,
  width: number
): void {
  const footerY = 30

  // Thank you message
  const thankYou = 'Thank you for your business!'
  const thankYouWidth = font.widthOfTextAtSize(thankYou, 10)
  page.drawText(thankYou, {
    x: (width - thankYouWidth) / 2,
    y: footerY,
    size: 10,
    font: font,
    color: COLORS.secondary,
  })
}

// Helper functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}
