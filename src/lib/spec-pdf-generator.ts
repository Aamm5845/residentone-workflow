import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFName, PDFArray, PDFString, PDFNumber } from 'pdf-lib'

// 24" x 36" landscape at 72 DPI
const PAGE_WIDTH = 2592  // 36 inches * 72 DPI
const PAGE_HEIGHT = 1728 // 24 inches * 72 DPI
const MARGIN = 72        // 1 inch margin

// Grid layout: 6 columns, 2 rows per page
const COLUMNS = 6
const ROWS_PER_PAGE = 2

// Calculate dimensions
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
const CELL_WIDTH = CONTENT_WIDTH / COLUMNS
const ROW_HEIGHT = (PAGE_HEIGHT - MARGIN * 2 - 50) / ROWS_PER_PAGE
const IMAGE_RADIUS = 130  // Circle radius for images (larger)

// Colors
const BRAND_COLOR = rgb(0.06, 0.72, 0.51) // Emerald green
const DARK_COLOR = rgb(0.15, 0.15, 0.15)
const LABEL_COLOR = rgb(0.5, 0.5, 0.5)
const LIGHTER_GRAY = rgb(0.75, 0.75, 0.75)
const LINK_COLOR = rgb(0.1, 0.4, 0.7)
const RED_COLOR = rgb(0.85, 0.15, 0.15) // Red for notes

export interface SpecPDFItem {
  id: string
  docCode?: string | null
  name: string
  brand?: string | null
  modelNumber?: string | null
  dimensions?: string | null
  finish?: string | null
  color?: string | null
  material?: string | null
  notes?: string | null
  supplierLink?: string | null
  supplierName?: string | null
  contact?: string | null
  imageUrl?: string | null
  categoryName: string
  roomName?: string
  quantity?: number
  leadTime?: string | null
  tradePrice?: number | null
  rrp?: number | null
}

export interface SpecPDFOptions {
  projectName: string
  includeCover?: boolean
  showBrand?: boolean
  showSupplier?: boolean
  showPricing?: boolean
  showDetails?: boolean
  showDimensions?: boolean
  showFinish?: boolean
  showColor?: boolean
  showMaterial?: boolean
  showNotes?: boolean
  showLink?: boolean
  showLeadTime?: boolean
  style?: 'grid' | 'list'
  pageSize?: '24x36' | 'letter' | 'tabloid'
  groupBy?: 'category' | 'room'
}

interface GroupedItems {
  groupName: string
  items: SpecPDFItem[]
}

export async function generateSpecPDF(
  items: SpecPDFItem[],
  options: SpecPDFOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  pdfDoc.setTitle(`${options.projectName} - Specifications`)
  pdfDoc.setAuthor('Meisner Interiors')
  pdfDoc.setCreationDate(new Date())

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  if (options.includeCover) {
    await addCoverPage(pdfDoc, options.projectName, helvetica, helveticaBold)
  }

  const groupBy = options.groupBy || 'category'
  const groupedItems = groupItems(items, groupBy)

  await addContentPages(pdfDoc, groupedItems, options, helvetica, helveticaBold)

  addPageNumbers(pdfDoc, helvetica, options.includeCover || false)

  return pdfDoc.save()
}

function groupItems(items: SpecPDFItem[], groupBy: 'category' | 'room'): GroupedItems[] {
  const grouped = new Map<string, SpecPDFItem[]>()

  for (const item of items) {
    const groupKey = groupBy === 'room'
      ? (item.roomName || 'Uncategorized')
      : (item.categoryName || 'Uncategorized')

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, [])
    }
    grouped.get(groupKey)!.push(item)
  }

  return Array.from(grouped.entries()).map(([groupName, items]) => ({
    groupName,
    items
  }))
}

async function addCoverPage(
  pdfDoc: PDFDocument,
  projectName: string,
  font: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.08, 0.08, 0.1)
  })

  const specbookText = 'SPECBOOK'
  const specbookSize = 120
  const specbookWidth = boldFont.widthOfTextAtSize(specbookText, specbookSize)
  page.drawText(specbookText, {
    x: (PAGE_WIDTH - specbookWidth) / 2,
    y: PAGE_HEIGHT / 2 + 100,
    size: specbookSize,
    font: boldFont,
    color: rgb(1, 1, 1)
  })

  const lineWidth = 400
  page.drawRectangle({
    x: (PAGE_WIDTH - lineWidth) / 2,
    y: PAGE_HEIGHT / 2 + 50,
    width: lineWidth,
    height: 3,
    color: BRAND_COLOR
  })

  const projectSize = 48
  const projectWidth = font.widthOfTextAtSize(projectName, projectSize)
  page.drawText(projectName, {
    x: (PAGE_WIDTH - projectWidth) / 2,
    y: PAGE_HEIGHT / 2 - 50,
    size: projectSize,
    font: font,
    color: rgb(1, 1, 1)
  })

  const dateText = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const dateWidth = font.widthOfTextAtSize(dateText, 24)
  page.drawText(dateText, {
    x: (PAGE_WIDTH - dateWidth) / 2,
    y: 200,
    size: 24,
    font: font,
    color: rgb(0.6, 0.6, 0.6)
  })

  const companyText = 'MEISNER INTERIORS'
  const companyWidth = font.widthOfTextAtSize(companyText, 18)
  page.drawText(companyText, {
    x: (PAGE_WIDTH - companyWidth) / 2,
    y: 120,
    size: 18,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  })
}

async function addContentPages(
  pdfDoc: PDFDocument,
  groups: GroupedItems[],
  options: SpecPDFOptions,
  font: PDFFont,
  boldFont: PDFFont
) {
  let currentPage: PDFPage | null = null
  let currentRow = 0
  let currentCol = 0

  const createNewPage = () => {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    currentRow = 0
    currentCol = 0

    // White background
    currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(1, 1, 1)
    })

    // Draw page header
    drawPageHeader(currentPage, options.projectName, font)

    return currentPage
  }

  let lastCategory = ''

  for (const group of groups) {
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]
      const isNewCategory = group.groupName !== lastCategory

      // New category starts a new row
      if (isNewCategory && currentCol > 0) {
        currentRow++
        currentCol = 0
      }

      // Need new page?
      if (currentPage === null || currentRow >= ROWS_PER_PAGE) {
        currentPage = createNewPage()
      }

      // Draw category header for first item of new category
      if (isNewCategory) {
        drawCategoryHeader(currentPage, group.groupName, currentRow, boldFont)
        lastCategory = group.groupName
      }

      // Draw item
      const cellX = MARGIN + (currentCol * CELL_WIDTH)
      await drawItemCell(pdfDoc, currentPage, item, cellX, currentRow, options, font, boldFont)

      // Next position
      currentCol++
      if (currentCol >= COLUMNS) {
        currentCol = 0
        currentRow++
      }
    }
  }
}

function drawPageHeader(page: PDFPage, projectName: string, font: PDFFont) {
  const textSize = 22
  const textWidth = font.widthOfTextAtSize(projectName, textSize)
  page.drawText(projectName, {
    x: PAGE_WIDTH - MARGIN - textWidth,
    y: PAGE_HEIGHT - MARGIN + 10,
    size: textSize,
    font: font,
    color: LIGHTER_GRAY
  })

  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN + 28,
    width: PAGE_WIDTH - (MARGIN * 2),
    height: 1,
    color: rgb(0.85, 0.85, 0.85)
  })
}

function drawCategoryHeader(page: PDFPage, groupName: string, row: number, boldFont: PDFFont) {
  const rowTop = PAGE_HEIGHT - MARGIN - 50 - (row * ROW_HEIGHT)

  // Category name at top of row
  page.drawText(groupName.toUpperCase(), {
    x: MARGIN,
    y: rowTop,
    size: 16,
    font: boldFont,
    color: LABEL_COLOR
  })

  // Accent line
  const textWidth = boldFont.widthOfTextAtSize(groupName.toUpperCase(), 16)
  page.drawRectangle({
    x: MARGIN,
    y: rowTop - 6,
    width: Math.min(textWidth + 8, 150),
    height: 2,
    color: BRAND_COLOR
  })
}

async function drawItemCell(
  pdfDoc: PDFDocument,
  page: PDFPage,
  item: SpecPDFItem,
  cellX: number,
  row: number,
  options: SpecPDFOptions,
  font: PDFFont,
  boldFont: PDFFont
) {
  const white = rgb(1, 1, 1)

  // Calculate positions
  const rowTop = PAGE_HEIGHT - MARGIN - 50 - (row * ROW_HEIGHT)
  const cellCenterX = cellX + CELL_WIDTH / 2

  // Image center - positioned lower but not too low (120px below category header)
  const circleCenterY = rowTop - 120 - IMAGE_RADIUS

  // === DRAW IMAGE ===
  if (item.imageUrl) {
    try {
      const response = await fetch(item.imageUrl)
      if (response.ok) {
        const imageBytes = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || ''

        let image
        if (contentType.includes('png')) {
          image = await pdfDoc.embedPng(imageBytes)
        } else {
          image = await pdfDoc.embedJpg(imageBytes)
        }

        const { width: imgWidth, height: imgHeight } = image
        const imgAspect = imgWidth / imgHeight

        // Scale to fill circle - use 1.0 to show maximum image content
        let drawWidth, drawHeight
        if (imgAspect > 1) {
          // Landscape image - fit height to circle
          drawHeight = IMAGE_RADIUS * 2
          drawWidth = drawHeight * imgAspect
        } else {
          // Portrait image - fit width to circle
          drawWidth = IMAGE_RADIUS * 2
          drawHeight = drawWidth / imgAspect
        }

        // No extra zoom - show as much of image as possible while filling circle
        const imgX = cellCenterX - drawWidth / 2
        const imgY = circleCenterY - drawHeight / 2

        // Draw image first
        page.drawImage(image, {
          x: imgX,
          y: imgY,
          width: drawWidth,
          height: drawHeight
        })

        // === CIRCULAR MASK ===
        // Calculate overflow beyond circle
        const extraWidth = Math.max((drawWidth / 2) - IMAGE_RADIUS, 0)
        const extraHeight = Math.max((drawHeight / 2) - IMAGE_RADIUS, 0)
        const overflow = Math.max(extraWidth, extraHeight, 60)  // Increased minimum

        // White circle stroke to create circular crop effect - thicker stroke
        const strokeWidth = overflow + 40  // Increased stroke width
        page.drawCircle({
          x: cellCenterX,
          y: circleCenterY,
          size: IMAGE_RADIUS + strokeWidth / 2,
          borderColor: white,
          borderWidth: strokeWidth,
          opacity: 0
        })

        // Additional corner masks - ensure full coverage
        const maskExtend = overflow + 30  // How far masks extend

        // Top mask
        page.drawRectangle({
          x: cellCenterX - IMAGE_RADIUS - maskExtend,
          y: circleCenterY + IMAGE_RADIUS,
          width: (IMAGE_RADIUS + maskExtend) * 2,
          height: maskExtend + 20,
          color: white
        })

        // Bottom mask - ensure no line shows
        page.drawRectangle({
          x: cellCenterX - IMAGE_RADIUS - maskExtend,
          y: circleCenterY - IMAGE_RADIUS - maskExtend - 20,
          width: (IMAGE_RADIUS + maskExtend) * 2,
          height: maskExtend + 20,
          color: white
        })

        // Left mask
        page.drawRectangle({
          x: cellCenterX - IMAGE_RADIUS - maskExtend - 20,
          y: circleCenterY - IMAGE_RADIUS - maskExtend,
          width: maskExtend + 20,
          height: (IMAGE_RADIUS + maskExtend) * 2,
          color: white
        })

        // Right mask
        page.drawRectangle({
          x: cellCenterX + IMAGE_RADIUS,
          y: circleCenterY - IMAGE_RADIUS - maskExtend,
          width: maskExtend + 20,
          height: (IMAGE_RADIUS + maskExtend) * 2,
          color: white
        })
      }
    } catch (error) {
      // Silent fail
    }
  }

  // === TEXT AREA - Below image, more centered ===
  const textAreaWidth = CELL_WIDTH - 40
  const textX = cellX + (CELL_WIDTH - textAreaWidth) / 2  // Center the text area
  const valueX = textX + 85  // More space for larger labels
  let textY = circleCenterY - IMAGE_RADIUS - 45  // Space between image and text
  const lineHeight = 28  // BIGGER line height for readability
  const labelSize = 16   // BIGGER label text (was 13)
  const valueSize = 17   // BIGGER value text (was 14)
  const maxValueWidth = textAreaWidth - 95

  // DOC CODE (green tag) - use actual docCode only, show "-" if missing
  const docCode = item.docCode || '-'
  page.drawText(docCode, {
    x: textX,
    y: textY,
    size: 20,  // BIGGER doc code (was 18)
    font: boldFont,
    color: BRAND_COLOR
  })
  textY -= lineHeight

  // ITEM NAME - show prominently below doc code
  const itemName = item.name || 'Unnamed Item'
  // Wrap name if too long
  const nameMaxWidth = textAreaWidth - 10
  const nameLines = wrapText(itemName, boldFont, 18, nameMaxWidth)
  for (const line of nameLines) {
    page.drawText(line, {
      x: textX,
      y: textY,
      size: 18,  // Prominent item name
      font: boldFont,
      color: DARK_COLOR
    })
    textY -= 24
  }
  textY -= 8  // Extra space after name

  // Helper to draw field - ALWAYS show label, value can be empty
  const drawField = (label: string, value: string | null | undefined, show: boolean = true) => {
    if (!show) return

    page.drawText(label + ':', {
      x: textX,
      y: textY,
      size: labelSize,
      font: font,
      color: LABEL_COLOR
    })

    if (value) {
      const truncatedValue = truncateText(value, font, valueSize, maxValueWidth)
      page.drawText(truncatedValue, {
        x: valueX,
        y: textY,
        size: valueSize,
        font: font,
        color: DARK_COLOR
      })
    }

    textY -= lineHeight
  }

  // Always show Brand and Model
  drawField('Brand', item.brand, options.showBrand)
  drawField('Model', item.modelNumber, true)

  // Other fields - show label always, value if present
  if (options.showDimensions) drawField('Size', item.dimensions)
  if (options.showFinish) drawField('Finish', item.finish)
  if (options.showColor) drawField('Color', item.color)
  if (options.showMaterial) drawField('Material', item.material)

  // NOTES - Show in RED, BIGGER, and wrap to multiple lines (no truncation)
  if (options.showNotes && item.notes) {
    page.drawText('Notes:', {
      x: textX,
      y: textY,
      size: labelSize,
      font: font,
      color: LABEL_COLOR
    })
    textY -= lineHeight

    // Wrap notes to multiple lines - show ALL text, no truncation
    const notesSize = 16  // Bigger notes text
    const notesMaxWidth = textAreaWidth - 20
    const notesLines = wrapText(item.notes, font, notesSize, notesMaxWidth)
    for (const line of notesLines) {
      page.drawText(line, {
        x: textX + 10,
        y: textY,
        size: notesSize,
        font: font,
        color: RED_COLOR  // RED for notes
      })
      textY -= 22
    }
  }

  // Link - show in blue with clickable annotation
  if (options.showLink && item.supplierLink) {
    const shortUrl = shortenUrl(item.supplierLink)
    page.drawText('Link:', {
      x: textX,
      y: textY,
      size: labelSize,
      font: font,
      color: LABEL_COLOR
    })

    // Draw link text
    const linkTextWidth = font.widthOfTextAtSize(shortUrl, valueSize)
    page.drawText(shortUrl, {
      x: valueX,
      y: textY,
      size: valueSize,
      font: font,
      color: LINK_COLOR
    })

    // Add clickable link annotation
    try {
      const context = pdfDoc.context

      // Create the URI action dictionary
      const actionDict = context.obj({
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(item.supplierLink)
      })

      // Create link annotation
      const linkAnnotation = context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [valueX, textY - 3, valueX + linkTextWidth + 5, textY + valueSize + 3],
        Border: [0, 0, 0],
        A: actionDict
      })

      // Add annotation to page
      const existingAnnots = page.node.lookup(PDFName.of('Annots'), PDFArray)
      if (existingAnnots) {
        existingAnnots.push(context.register(linkAnnotation))
      } else {
        page.node.set(PDFName.of('Annots'), context.obj([context.register(linkAnnotation)]))
      }
    } catch {
      // Fallback - link will just be visual
    }

    textY -= lineHeight
  }

  if (options.showSupplier) drawField('Vendor', item.supplierName)
  if (options.showLeadTime) drawField('Lead Time', item.leadTime)

  // Pricing - show trade price and RRP if enabled
  if (options.showPricing) {
    if (item.tradePrice) {
      drawField('Trade', `$${item.tradePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
    if (item.rrp) {
      drawField('RRP', `$${item.rrp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
  }
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let truncated = text
  while (font.widthOfTextAtSize(truncated, size) > maxWidth && truncated.length > 3) {
    truncated = truncated.slice(0, -4) + '...'
  }
  return truncated
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, size)

    if (testWidth <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      // If single word is too long, truncate it
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let truncWord = word
        while (font.widthOfTextAtSize(truncWord, size) > maxWidth && truncWord.length > 3) {
          truncWord = truncWord.slice(0, -1)
        }
        currentLine = truncWord
      } else {
        currentLine = word
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let short = parsed.hostname.replace('www.', '')
    if (parsed.pathname && parsed.pathname !== '/') {
      short += '/...'
    }
    return short.length > 20 ? short.slice(0, 17) + '...' : short
  } catch {
    return url.length > 20 ? url.slice(0, 17) + '...' : url
  }
}

function addPageNumbers(pdfDoc: PDFDocument, font: PDFFont, hasCover: boolean) {
  const pages = pdfDoc.getPages()
  const startIndex = hasCover ? 1 : 0

  for (let i = startIndex; i < pages.length; i++) {
    const page = pages[i]
    const pageNum = hasCover ? i : i + 1
    const text = `${pageNum}`
    const textWidth = font.widthOfTextAtSize(text, 16)

    page.drawText(text, {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y: MARGIN - 20,
      size: 16,
      font,
      color: LIGHTER_GRAY
    })
  }
}
