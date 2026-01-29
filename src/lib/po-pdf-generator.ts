import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'

interface POLineItem {
  name: string
  description?: string | null
  quantity: number
  unitType?: string | null
  unitPrice: number
  totalPrice: number
}

interface POData {
  orderNumber: string
  createdAt: Date
  orderedAt?: Date | null
  expectedDelivery?: Date | null

  // Vendor info
  vendorName: string
  vendorEmail?: string | null
  vendorPhone?: string | null
  vendorAddress?: string | null

  // Project info
  projectName: string
  projectAddress?: string | null
  clientName?: string | null

  // Shipping
  shippingAddress?: string | null
  shippingMethod?: string | null

  // Line items
  lineItems: POLineItem[]

  // Pricing
  subtotal: number
  shippingCost: number
  extraCharges?: Array<{ label: string; amount: number }> | null
  taxAmount: number
  totalAmount: number
  currency: string

  // Deposit
  depositPercent?: number | null
  depositRequired?: number | null
  depositPaid?: number | null

  // Payment
  amountPaid?: number | null
  balanceDue?: number | null

  // Notes
  notes?: string | null
  paymentTerms?: string | null
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
}

// Color scheme
const COLORS = {
  primary: rgb(0.2, 0.2, 0.2),      // Dark gray for text
  secondary: rgb(0.4, 0.4, 0.4),    // Medium gray
  light: rgb(0.6, 0.6, 0.6),        // Light gray
  accent: rgb(0.1, 0.4, 0.6),       // Blue accent (slightly different from invoice)
  white: rgb(1, 1, 1),
  tableHeader: rgb(0.93, 0.93, 0.93), // Light gray background
  tableBorder: rgb(0.8, 0.8, 0.8),
}

const PAGE_MARGIN = 50
const LINE_HEIGHT = 14
const SECTION_GAP = 20

/**
 * Generate a professional PDF Purchase Order
 */
export async function generatePOPdf(
  po: POData,
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
  yPos = drawHeader(page, organization, po, helvetica, helveticaBold, yPos, width)

  // === VENDOR & SHIP TO SECTION ===
  yPos -= SECTION_GAP
  yPos = drawVendorShipToSection(page, po, helvetica, helveticaBold, yPos, width)

  // === LINE ITEMS TABLE ===
  yPos -= SECTION_GAP
  const result = drawLineItemsTable(pdfDoc, page, po.lineItems, helvetica, helveticaBold, yPos, width, po.currency)
  page = result.page
  yPos = result.yPos

  // === TOTALS SECTION ===
  yPos -= SECTION_GAP
  yPos = drawTotals(page, po, helvetica, helveticaBold, yPos, width)

  // === NOTES & TERMS ===
  if (po.notes || po.paymentTerms) {
    yPos -= SECTION_GAP

    // Check if we need a new page
    if (yPos < 150) {
      page = pdfDoc.addPage([612, 792])
      yPos = height - PAGE_MARGIN
    }

    yPos = drawNotesSection(page, po, helvetica, helveticaBold, yPos)
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
  po: POData,
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

  // PURCHASE ORDER title (right aligned)
  const poTitle = 'PURCHASE ORDER'
  const titleWidth = boldFont.widthOfTextAtSize(poTitle, 20)
  page.drawText(poTitle, {
    x: width - PAGE_MARGIN - titleWidth,
    y: yPos,
    size: 20,
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

  // PO details (right side)
  const rightX = width - PAGE_MARGIN - 150
  let rightY = yPos + (addressParts.length * LINE_HEIGHT) + LINE_HEIGHT

  // PO Number
  page.drawText('PO #:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: boldFont,
    color: COLORS.primary,
  })
  page.drawText(po.orderNumber, {
    x: rightX + 70,
    y: rightY,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  rightY -= LINE_HEIGHT

  // Date
  const dateStr = formatDate(po.orderedAt || po.createdAt)
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

  // Expected Delivery
  if (po.expectedDelivery) {
    const deliveryStr = formatDate(po.expectedDelivery)
    page.drawText('Delivery:', {
      x: rightX,
      y: rightY,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    })
    page.drawText(deliveryStr, {
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
  let projectName = po.projectName
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

function drawVendorShipToSection(
  page: PDFPage,
  po: POData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number,
  width: number
): number {
  const colWidth = (width - (2 * PAGE_MARGIN) - 20) / 2
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + colWidth + 20

  // Left column: VENDOR
  page.drawText('VENDOR:', {
    x: leftX,
    y: yPos,
    size: 10,
    font: boldFont,
    color: COLORS.accent,
  })

  // Right column: SHIP TO
  page.drawText('SHIP TO:', {
    x: rightX,
    y: yPos,
    size: 10,
    font: boldFont,
    color: COLORS.accent,
  })

  yPos -= LINE_HEIGHT + 2

  // Vendor name
  page.drawText(po.vendorName, {
    x: leftX,
    y: yPos,
    size: 11,
    font: boldFont,
    color: COLORS.primary,
  })

  // Ship to address first line (project name or company)
  const shipToName = po.projectName
  page.drawText(shipToName, {
    x: rightX,
    y: yPos,
    size: 11,
    font: boldFont,
    color: COLORS.primary,
  })

  yPos -= LINE_HEIGHT

  // Vendor email
  if (po.vendorEmail) {
    page.drawText(po.vendorEmail, {
      x: leftX,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Vendor phone
  if (po.vendorPhone) {
    page.drawText(po.vendorPhone, {
      x: leftX,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Vendor address
  if (po.vendorAddress) {
    const vendorLines = po.vendorAddress.split('\n')
    for (const line of vendorLines.slice(0, 3)) {
      page.drawText(line, {
        x: leftX,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
  }

  // Ship to address (right column)
  let shipY = yPos + (po.vendorEmail ? LINE_HEIGHT : 0) + (po.vendorPhone ? LINE_HEIGHT : 0) + (po.vendorAddress ? LINE_HEIGHT * Math.min(po.vendorAddress.split('\n').length, 3) : 0)

  if (po.shippingAddress) {
    const shipLines = po.shippingAddress.split('\n')
    for (const line of shipLines.slice(0, 4)) {
      page.drawText(line, {
        x: rightX,
        y: shipY,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      shipY -= LINE_HEIGHT
    }
  } else if (po.projectAddress) {
    const addrLines = po.projectAddress.split('\n')
    for (const line of addrLines.slice(0, 4)) {
      page.drawText(line, {
        x: rightX,
        y: shipY,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      shipY -= LINE_HEIGHT
    }
  }

  // Shipping method
  if (po.shippingMethod) {
    shipY -= 5
    page.drawText(`Shipping: ${po.shippingMethod}`, {
      x: rightX,
      y: shipY,
      size: 9,
      font: font,
      color: COLORS.light,
    })
  }

  return yPos - 10
}

function drawLineItemsTable(
  pdfDoc: PDFDocument,
  page: PDFPage,
  items: POLineItem[],
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number,
  width: number,
  currency: string
): { page: PDFPage; yPos: number } {
  const tableWidth = width - (2 * PAGE_MARGIN)
  const colWidths = {
    item: tableWidth * 0.45,
    qty: tableWidth * 0.10,
    unit: tableWidth * 0.20,
    total: tableWidth * 0.25,
  }

  const rowHeight = 22

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

  // Center the Unit Price header in its column
  const unitPriceHeaderText = 'Unit Price'
  const unitPriceHeaderWidth = boldFont.widthOfTextAtSize(unitPriceHeaderText, 10)
  const unitPriceHeaderCenterX = xPos + (colWidths.unit - unitPriceHeaderWidth) / 2
  page.drawText(unitPriceHeaderText, {
    x: unitPriceHeaderCenterX,
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
    let itemName = item.name
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

    // Quantity (just the number)
    const qtyText = `${item.quantity}`
    page.drawText(qtyText, {
      x: xPos,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })
    xPos += colWidths.qty

    // Unit price (centered in its column)
    const unitPriceText = formatCurrency(item.unitPrice, currency)
    const unitPriceWidth = font.widthOfTextAtSize(unitPriceText, 9)
    const unitPriceCenterX = xPos + (colWidths.unit - unitPriceWidth) / 2
    page.drawText(unitPriceText, {
      x: unitPriceCenterX,
      y: textY,
      size: 9,
      font: font,
      color: COLORS.primary,
    })

    // Total (right-aligned)
    const totalText = formatCurrency(item.totalPrice, currency)
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
  po: POData,
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
  const subtotalText = formatCurrency(po.subtotal, po.currency)
  const subtotalWidth = font.widthOfTextAtSize(subtotalText, 10)
  page.drawText(subtotalText, {
    x: valueX - subtotalWidth,
    y: yPos,
    size: 10,
    font: font,
    color: COLORS.primary,
  })
  yPos -= LINE_HEIGHT

  // Shipping
  if (po.shippingCost > 0) {
    page.drawText('Shipping:', {
      x: rightX,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    const shipText = formatCurrency(po.shippingCost, po.currency)
    const shipWidth = font.widthOfTextAtSize(shipText, 10)
    page.drawText(shipText, {
      x: valueX - shipWidth,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  // Extra charges (customs, handling, etc.)
  if (po.extraCharges && po.extraCharges.length > 0) {
    for (const charge of po.extraCharges) {
      page.drawText(`${charge.label}:`, {
        x: rightX,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      const chargeText = formatCurrency(charge.amount, po.currency)
      const chargeWidth = font.widthOfTextAtSize(chargeText, 10)
      page.drawText(chargeText, {
        x: valueX - chargeWidth,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
  }

  // Tax
  if (po.taxAmount > 0) {
    page.drawText('Tax:', {
      x: rightX,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    const taxText = formatCurrency(po.taxAmount, po.currency)
    const taxWidth = font.widthOfTextAtSize(taxText, 10)
    page.drawText(taxText, {
      x: valueX - taxWidth,
      y: yPos,
      size: 10,
      font: font,
      color: COLORS.secondary,
    })
    yPos -= LINE_HEIGHT
  }

  yPos -= 5

  // Draw line before total
  page.drawLine({
    start: { x: rightX - 10, y: yPos },
    end: { x: width - PAGE_MARGIN, y: yPos },
    thickness: 1,
    color: COLORS.tableBorder,
  })
  yPos -= 15

  // Total (bold)
  page.drawText('TOTAL:', {
    x: rightX,
    y: yPos,
    size: 12,
    font: boldFont,
    color: COLORS.primary,
  })
  const totalText = formatCurrency(po.totalAmount, po.currency)
  const totalWidth = boldFont.widthOfTextAtSize(totalText, 12)
  page.drawText(totalText, {
    x: valueX - totalWidth,
    y: yPos,
    size: 12,
    font: boldFont,
    color: COLORS.accent,
  })
  yPos -= LINE_HEIGHT + 5

  // Deposit and Payment information
  const hasDepositOrPayment = (po.depositRequired && po.depositRequired > 0) || (po.amountPaid && po.amountPaid > 0)

  if (hasDepositOrPayment) {
    yPos -= 10

    // Draw line before deposit/payment section
    page.drawLine({
      start: { x: rightX - 10, y: yPos },
      end: { x: width - PAGE_MARGIN, y: yPos },
      thickness: 0.5,
      color: COLORS.tableBorder,
    })
    yPos -= 15

    // Deposit Required (if applicable)
    if (po.depositRequired && po.depositRequired > 0) {
      page.drawText('Deposit Required:', {
        x: rightX,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      const depositText = formatCurrency(po.depositRequired, po.currency)
      const depositWidth = font.widthOfTextAtSize(depositText, 10)
      page.drawText(depositText, {
        x: valueX - depositWidth,
        y: yPos,
        size: 10,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }

    // Amount Paid
    if (po.amountPaid && po.amountPaid > 0) {
      page.drawText('Amount Paid:', {
        x: rightX,
        y: yPos,
        size: 10,
        font: font,
        color: rgb(0.1, 0.5, 0.3), // Green color
      })
      const paidText = formatCurrency(po.amountPaid, po.currency)
      const paidWidth = font.widthOfTextAtSize(paidText, 10)
      page.drawText(paidText, {
        x: valueX - paidWidth,
        y: yPos,
        size: 10,
        font: font,
        color: rgb(0.1, 0.5, 0.3),
      })
      yPos -= LINE_HEIGHT
    }

    // Balance Due
    if (po.balanceDue && po.balanceDue > 0) {
      page.drawText('Balance Due:', {
        x: rightX,
        y: yPos,
        size: 10,
        font: boldFont,
        color: rgb(0.7, 0.3, 0.1), // Orange/amber color
      })
      const balanceText = formatCurrency(po.balanceDue, po.currency)
      const balanceWidth = boldFont.widthOfTextAtSize(balanceText, 10)
      page.drawText(balanceText, {
        x: valueX - balanceWidth,
        y: yPos,
        size: 10,
        font: boldFont,
        color: rgb(0.7, 0.3, 0.1),
      })
      yPos -= LINE_HEIGHT
    }
  }

  return yPos
}

function drawNotesSection(
  page: PDFPage,
  po: POData,
  font: PDFFont,
  boldFont: PDFFont,
  yPos: number
): number {
  // Notes
  if (po.notes) {
    page.drawText('NOTES:', {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: boldFont,
      color: COLORS.accent,
    })
    yPos -= LINE_HEIGHT

    const noteLines = po.notes.split('\n')
    for (const line of noteLines.slice(0, 5)) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: yPos,
        size: 9,
        font: font,
        color: COLORS.secondary,
      })
      yPos -= LINE_HEIGHT
    }
    yPos -= 10
  }

  // Payment Terms
  if (po.paymentTerms) {
    page.drawText('PAYMENT TERMS:', {
      x: PAGE_MARGIN,
      y: yPos,
      size: 10,
      font: boldFont,
      color: COLORS.accent,
    })
    yPos -= LINE_HEIGHT

    page.drawText(po.paymentTerms, {
      x: PAGE_MARGIN,
      y: yPos,
      size: 9,
      font: font,
      color: COLORS.secondary,
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

  // Tax numbers
  const taxNumbers: string[] = []
  if (org.gstNumber) taxNumbers.push(`GST# ${org.gstNumber}`)
  if (org.qstNumber) taxNumbers.push(`QST# ${org.qstNumber}`)
  if (org.neqNumber) taxNumbers.push(`NEQ# ${org.neqNumber}`)

  if (taxNumbers.length > 0) {
    const taxText = taxNumbers.join('   |   ')
    const taxWidth = font.widthOfTextAtSize(taxText, 8)
    page.drawText(taxText, {
      x: (width - taxWidth) / 2,
      y: footerY + 15,
      size: 8,
      font: font,
      color: COLORS.light,
    })
  }

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
function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}
