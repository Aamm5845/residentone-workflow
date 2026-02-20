'use server'

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib'

interface ClientQuotePDFData {
  quoteNumber: string
  title: string
  description?: string | null
  projectName: string
  projectNumber?: string | null
  clientName: string
  clientEmail?: string | null
  clientPhone?: string | null
  clientAddress?: string | null
  createdAt: Date
  validUntil?: Date | null
  paymentTerms?: string | null
  depositRequired?: string | null
  depositAmount?: number | null
  paymentSchedule?: { label: string; percent: number }[] | null
  lineItems: {
    itemName: string
    itemDescription?: string | null
    quantity: number
    unitType: string
    sellingPrice: number
    totalPrice: number
    groupId?: string | null
  }[]
  subtotal: number
  taxRate?: number | null
  taxAmount?: number | null
  shippingCost?: number | null
  totalAmount?: number | null
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyLogo?: string
}

export async function generateClientQuotePDF(data: ClientQuotePDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Page setup
  const pageWidth = PageSizes.Letter[0]
  const pageHeight = PageSizes.Letter[1]
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage(PageSizes.Letter)
  let y = pageHeight - margin

  // Colors
  const primaryColor = rgb(0.06, 0.72, 0.51) // Emerald/Green
  const darkColor = rgb(0.12, 0.16, 0.21) // Dark gray
  const lightGray = rgb(0.6, 0.6, 0.6)
  const tableHeaderBg = rgb(0.95, 0.95, 0.95)

  // Helper functions
  const drawText = (text: string, x: number, yPos: number, options: {
    font?: typeof helvetica,
    size?: number,
    color?: ReturnType<typeof rgb>,
    maxWidth?: number
  } = {}) => {
    const font = options.font || helvetica
    const size = options.size || 10
    const color = options.color || darkColor

    if (options.maxWidth) {
      const words = text.split(' ')
      let line = ''
      let currentY = yPos

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word
        const testWidth = font.widthOfTextAtSize(testLine, size)

        if (testWidth > options.maxWidth && line) {
          page.drawText(line, { x, y: currentY, size, font, color })
          line = word
          currentY -= size + 2
        } else {
          line = testLine
        }
      }

      if (line) {
        page.drawText(line, { x, y: currentY, size, font, color })
        return currentY - size - 2
      }
      return currentY
    }

    page.drawText(text, { x, y: yPos, size, font, color })
    return yPos - size - 4
  }

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Header with company info
  const companyName = data.companyName || 'Meisner Interiors'
  y = drawText(companyName, margin, y, { font: helveticaBold, size: 20, color: primaryColor })
  y -= 5

  if (data.companyAddress) {
    y = drawText(data.companyAddress, margin, y, { size: 9, color: lightGray })
  }
  if (data.companyPhone || data.companyEmail) {
    const contactInfo = [data.companyPhone, data.companyEmail].filter(Boolean).join(' | ')
    y = drawText(contactInfo, margin, y, { size: 9, color: lightGray })
  }

  // Quote title on right side of header
  const quoteLabel = 'QUOTE'
  const quoteLabelWidth = helveticaBold.widthOfTextAtSize(quoteLabel, 24)
  page.drawText(quoteLabel, {
    x: pageWidth - margin - quoteLabelWidth,
    y: pageHeight - margin,
    size: 24,
    font: helveticaBold,
    color: primaryColor
  })

  page.drawText(data.quoteNumber, {
    x: pageWidth - margin - helvetica.widthOfTextAtSize(data.quoteNumber, 12),
    y: pageHeight - margin - 20,
    size: 12,
    font: helvetica,
    color: darkColor
  })

  // Divider line
  y -= 15
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9)
  })
  y -= 25

  // Two column layout for quote details and client info
  const col1X = margin
  const col2X = pageWidth / 2 + 20

  // Quote details (left column)
  let leftY = y
  leftY = drawText('Quote Details', col1X, leftY, { font: helveticaBold, size: 11, color: darkColor })
  leftY -= 5

  leftY = drawText(`Date: ${formatDate(data.createdAt)}`, col1X, leftY, { size: 9 })
  if (data.validUntil) {
    leftY = drawText(`Valid Until: ${formatDate(data.validUntil)}`, col1X, leftY, { size: 9, color: rgb(0.8, 0.2, 0.2) })
  }
  leftY = drawText(`Project: ${data.projectName}`, col1X, leftY, { size: 9 })
  if (data.projectNumber) {
    leftY = drawText(`Project #: ${data.projectNumber}`, col1X, leftY, { size: 9 })
  }

  // Client info (right column)
  let rightY = y
  rightY = drawText('Bill To', col2X, rightY, { font: helveticaBold, size: 11, color: darkColor })
  rightY -= 5

  rightY = drawText(data.clientName, col2X, rightY, { font: helveticaBold, size: 10 })
  if (data.clientEmail) {
    rightY = drawText(data.clientEmail, col2X, rightY, { size: 9 })
  }
  if (data.clientPhone) {
    rightY = drawText(data.clientPhone, col2X, rightY, { size: 9 })
  }
  if (data.clientAddress) {
    rightY = drawText(data.clientAddress, col2X, rightY, { size: 9, maxWidth: 200 })
  }

  y = Math.min(leftY, rightY) - 25

  // Quote title and description
  y = drawText(data.title, margin, y, { font: helveticaBold, size: 14, color: darkColor })
  if (data.description) {
    y -= 3
    y = drawText(data.description, margin, y, { size: 9, color: lightGray, maxWidth: contentWidth })
  }
  y -= 20

  // Line items table
  const tableStartY = y
  const colWidths = {
    item: 220,
    qty: 50,
    unit: 70,
    price: 80,
    total: 90
  }

  // Table header
  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: contentWidth,
    height: 22,
    color: tableHeaderBg
  })

  let tableX = margin + 5
  page.drawText('Item', { x: tableX, y: y - 12, size: 9, font: helveticaBold, color: darkColor })
  tableX += colWidths.item
  page.drawText('Qty', { x: tableX, y: y - 12, size: 9, font: helveticaBold, color: darkColor })
  tableX += colWidths.qty
  page.drawText('Unit', { x: tableX, y: y - 12, size: 9, font: helveticaBold, color: darkColor })
  tableX += colWidths.unit
  page.drawText('Unit Price', { x: tableX, y: y - 12, size: 9, font: helveticaBold, color: darkColor })
  tableX += colWidths.price
  page.drawText('Total', { x: tableX, y: y - 12, size: 9, font: helveticaBold, color: darkColor })

  y -= 25

  // Group items by category if they have groupId
  const groupedItems = new Map<string, typeof data.lineItems>()
  for (const item of data.lineItems) {
    const groupKey = item.groupId || 'Other'
    if (!groupedItems.has(groupKey)) {
      groupedItems.set(groupKey, [])
    }
    groupedItems.get(groupKey)!.push(item)
  }

  // Table rows
  let rowIndex = 0
  const groupEntries = Array.from(groupedItems.entries())
  for (const [groupName, items] of groupEntries) {
    // Check if we need a new page
    if (y < 150) {
      page = pdfDoc.addPage(PageSizes.Letter)
      y = pageHeight - margin
    }

    // Group header (if multiple groups)
    if (groupEntries.length > 1) {
      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: contentWidth,
        height: 18,
        color: rgb(0.93, 0.93, 0.93)
      })
      page.drawText(groupName, { x: margin + 5, y: y - 10, size: 9, font: helveticaBold, color: darkColor })
      y -= 20
    }

    for (const item of items) {
      // Check if we need a new page
      if (y < 100) {
        page = pdfDoc.addPage(PageSizes.Letter)
        y = pageHeight - margin
      }

      // Alternate row background
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: contentWidth,
          height: 18,
          color: rgb(0.98, 0.98, 0.98)
        })
      }

      tableX = margin + 5

      // Item name (truncate if too long)
      let itemName = item.itemName
      while (helvetica.widthOfTextAtSize(itemName, 9) > colWidths.item - 10 && itemName.length > 3) {
        itemName = itemName.slice(0, -4) + '...'
      }
      page.drawText(itemName, { x: tableX, y: y - 10, size: 9, font: helvetica, color: darkColor })
      tableX += colWidths.item

      page.drawText(item.quantity.toString(), { x: tableX, y: y - 10, size: 9, font: helvetica, color: darkColor })
      tableX += colWidths.qty

      page.drawText(item.unitType, { x: tableX, y: y - 10, size: 9, font: helvetica, color: darkColor })
      tableX += colWidths.unit

      page.drawText(formatCurrency(item.sellingPrice), { x: tableX, y: y - 10, size: 9, font: helvetica, color: darkColor })
      tableX += colWidths.price

      page.drawText(formatCurrency(item.totalPrice), { x: tableX, y: y - 10, size: 9, font: helveticaBold, color: darkColor })

      y -= 18
      rowIndex++
    }
  }

  // Table bottom line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85)
  })
  y -= 25

  // Totals section (right aligned)
  const totalsX = pageWidth - margin - 200
  const valuesX = pageWidth - margin - 10

  // Subtotal
  page.drawText('Subtotal:', { x: totalsX, y, size: 10, font: helvetica, color: darkColor })
  const subtotalText = formatCurrency(data.subtotal)
  page.drawText(subtotalText, {
    x: valuesX - helveticaBold.widthOfTextAtSize(subtotalText, 10),
    y,
    size: 10,
    font: helveticaBold,
    color: darkColor
  })
  y -= 16

  // Tax
  if (data.taxRate && data.taxAmount) {
    page.drawText(`Tax (${data.taxRate}%):`, { x: totalsX, y, size: 10, font: helvetica, color: darkColor })
    const taxText = formatCurrency(data.taxAmount)
    page.drawText(taxText, {
      x: valuesX - helvetica.widthOfTextAtSize(taxText, 10),
      y,
      size: 10,
      font: helvetica,
      color: darkColor
    })
    y -= 16
  }

  // Shipping
  if (data.shippingCost && data.shippingCost > 0) {
    page.drawText('Shipping:', { x: totalsX, y, size: 10, font: helvetica, color: darkColor })
    const shippingText = formatCurrency(data.shippingCost)
    page.drawText(shippingText, {
      x: valuesX - helvetica.widthOfTextAtSize(shippingText, 10),
      y,
      size: 10,
      font: helvetica,
      color: darkColor
    })
    y -= 16
  }

  // Total
  const totalAmount = data.totalAmount || data.subtotal
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 8,
    width: 210,
    height: 28,
    color: primaryColor
  })
  page.drawText('TOTAL:', { x: totalsX, y, size: 12, font: helveticaBold, color: rgb(1, 1, 1) })
  const totalText = formatCurrency(totalAmount)
  page.drawText(totalText, {
    x: valuesX - helveticaBold.widthOfTextAtSize(totalText, 14),
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  })
  y -= 45

  // Payment schedule breakdown
  if (data.paymentSchedule && data.paymentSchedule.length > 0) {
    page.drawText('Payment Schedule:', { x: totalsX, y, size: 10, font: helveticaBold, color: darkColor })
    y -= 16
    for (const milestone of data.paymentSchedule) {
      const milestoneAmount = Math.round(totalAmount * milestone.percent / 100 * 100) / 100
      const label = `${milestone.label || 'Payment'} (${milestone.percent}%): ${formatCurrency(milestoneAmount)}`
      page.drawText(label, {
        x: totalsX,
        y,
        size: 9,
        font: helvetica,
        color: lightGray
      })
      y -= 14
    }
  } else if (data.depositRequired && data.depositAmount) {
    // Fallback: simple deposit for legacy invoices
    page.drawText(`Deposit Required: ${formatCurrency(data.depositAmount)}`, {
      x: totalsX,
      y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.8, 0.2, 0.2)
    })
    y -= 16
  }

  // Payment terms (hide "Custom schedule" when a schedule is present)
  if (data.paymentTerms && data.paymentTerms !== 'Custom schedule') {
    y -= 20
    page.drawText('Payment Terms:', { x: margin, y, size: 10, font: helveticaBold, color: darkColor })
    y -= 14
    y = drawText(data.paymentTerms, margin, y, { size: 9, color: lightGray, maxWidth: contentWidth })
  }

  // Footer
  const footerY = 40
  page.drawLine({
    start: { x: margin, y: footerY + 15 },
    end: { x: pageWidth - margin, y: footerY + 15 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9)
  })

  page.drawText('Thank you for your business!', {
    x: pageWidth / 2 - helvetica.widthOfTextAtSize('Thank you for your business!', 9) / 2,
    y: footerY,
    size: 9,
    font: helvetica,
    color: lightGray
  })

  // Page numbers
  const pages = pdfDoc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const pageNum = `Page ${i + 1} of ${pages.length}`
    pages[i].drawText(pageNum, {
      x: pageWidth - margin - helvetica.widthOfTextAtSize(pageNum, 8),
      y: 25,
      size: 8,
      font: helvetica,
      color: lightGray
    })
  }

  return pdfDoc.save()
}
