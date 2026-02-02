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
  coverStyle?: 'dark' | 'minimal'  // Cover page style option
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

// Pre-fetch and embed all images in parallel for faster PDF generation
async function prefetchImages(
  pdfDoc: PDFDocument,
  items: SpecPDFItem[]
): Promise<Map<string, any>> {
  const imageMap = new Map<string, any>()

  // Collect all unique image URLs
  const imageUrls = [...new Set(items.map(item => item.imageUrl).filter(Boolean))] as string[]

  // Fetch all images in parallel with 15-second timeout each
  const fetchPromises = imageUrls.map(async (url) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const imageBytes = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || ''

        let image
        if (contentType.includes('png')) {
          image = await pdfDoc.embedPng(imageBytes)
        } else {
          image = await pdfDoc.embedJpg(imageBytes)
        }

        return { url, image }
      }
    } catch (error) {
      // Silent fail for individual images - continue with others
      console.log(`Failed to fetch image: ${url}`)
    }
    return { url, image: null }
  })

  const results = await Promise.all(fetchPromises)

  for (const result of results) {
    if (result.image) {
      imageMap.set(result.url, result.image)
    }
  }

  return imageMap
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

  // Pre-fetch all images in parallel (much faster than sequential)
  const imageMap = await prefetchImages(pdfDoc, items)

  if (options.includeCover) {
    // Choose cover style - default to 'dark' for backwards compatibility
    if (options.coverStyle === 'minimal') {
      await addCoverPageMinimal(pdfDoc, options.projectName, helvetica, helveticaBold)
    } else {
      await addCoverPage(pdfDoc, options.projectName, helvetica, helveticaBold)
    }
  }

  const groupBy = options.groupBy || 'category'
  const groupedItems = groupItems(items, groupBy)

  await addContentPages(pdfDoc, groupedItems, options, helvetica, helveticaBold, imageMap)

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
  const sanitizedProjectName = sanitizeText(projectName)
  const projectWidth = font.widthOfTextAtSize(sanitizedProjectName, projectSize)
  page.drawText(sanitizedProjectName, {
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

// Minimal/Modern cover page - clean white design
async function addCoverPageMinimal(
  pdfDoc: PDFDocument,
  projectName: string,
  font: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // Clean white background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1)
  })

  // Subtle top border accent
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: BRAND_COLOR
  })

  // Left side vertical line accent
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT / 2 - 200,
    width: 3,
    height: 400,
    color: rgb(0.9, 0.9, 0.9)
  })

  // "SPECIFICATIONS" label - small, uppercase, spaced
  const labelText = 'S P E C I F I C A T I O N S'
  const labelSize = 14
  const labelWidth = font.widthOfTextAtSize(labelText, labelSize)
  page.drawText(labelText, {
    x: MARGIN + 30,
    y: PAGE_HEIGHT / 2 + 180,
    size: labelSize,
    font: font,
    color: rgb(0.6, 0.6, 0.6)
  })

  // Project name - large, bold, left-aligned
  const sanitizedProjectName = sanitizeText(projectName)
  const projectSize = 72
  const projectLines = wrapText(sanitizedProjectName, boldFont, projectSize, PAGE_WIDTH - MARGIN * 2 - 60)
  let projectY = PAGE_HEIGHT / 2 + 100
  for (const line of projectLines) {
    page.drawText(line, {
      x: MARGIN + 30,
      y: projectY,
      size: projectSize,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1)
    })
    projectY -= 85
  }

  // Thin horizontal line under project name
  page.drawRectangle({
    x: MARGIN + 30,
    y: projectY + 30,
    width: 200,
    height: 2,
    color: BRAND_COLOR
  })

  // Date - clean, minimal
  const dateText = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  page.drawText(dateText, {
    x: MARGIN + 30,
    y: projectY - 20,
    size: 18,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  })

  // Company name - bottom left, subtle
  const companyText = 'MEISNER INTERIORS'
  page.drawText(companyText, {
    x: MARGIN + 30,
    y: MARGIN + 40,
    size: 16,
    font: font,
    color: rgb(0.7, 0.7, 0.7)
  })

  // Small decorative squares in bottom right
  const squareSize = 20
  const squareGap = 8
  const squareStartX = PAGE_WIDTH - MARGIN - (squareSize * 3 + squareGap * 2)
  const squareY = MARGIN + 30

  // Three small squares
  page.drawRectangle({
    x: squareStartX,
    y: squareY,
    width: squareSize,
    height: squareSize,
    color: rgb(0.92, 0.92, 0.92)
  })
  page.drawRectangle({
    x: squareStartX + squareSize + squareGap,
    y: squareY,
    width: squareSize,
    height: squareSize,
    color: rgb(0.85, 0.85, 0.85)
  })
  page.drawRectangle({
    x: squareStartX + (squareSize + squareGap) * 2,
    y: squareY,
    width: squareSize,
    height: squareSize,
    color: BRAND_COLOR
  })
}

async function addContentPages(
  pdfDoc: PDFDocument,
  groups: GroupedItems[],
  options: SpecPDFOptions,
  font: PDFFont,
  boldFont: PDFFont,
  imageMap: Map<string, any>
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
      await drawItemCell(pdfDoc, currentPage, item, cellX, currentRow, options, font, boldFont, imageMap)

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
  const sanitizedProjectName = sanitizeText(projectName)
  const textWidth = font.widthOfTextAtSize(sanitizedProjectName, textSize)
  page.drawText(sanitizedProjectName, {
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

  // Category name at top of row - sanitize to handle any problematic characters
  const sanitizedGroupName = sanitizeText(groupName).toUpperCase()
  page.drawText(sanitizedGroupName, {
    x: MARGIN,
    y: rowTop,
    size: 16,
    font: boldFont,
    color: LABEL_COLOR
  })

  // Accent line
  const textWidth = boldFont.widthOfTextAtSize(sanitizedGroupName, 16)
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
  boldFont: PDFFont,
  imageMap: Map<string, any>
) {
  const white = rgb(1, 1, 1)

  // Calculate positions
  const rowTop = PAGE_HEIGHT - MARGIN - 50 - (row * ROW_HEIGHT)
  const cellCenterX = cellX + CELL_WIDTH / 2

  // Image center - positioned lower but not too low (120px below category header)
  const circleCenterY = rowTop - 120 - IMAGE_RADIUS

  // === DRAW IMAGE ===
  // Use pre-fetched image from imageMap (fetched in parallel for speed)
  if (item.imageUrl) {
    const image = imageMap.get(item.imageUrl)
    if (image) {
      try {
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
      } catch (error) {
        // Silent fail - image couldn't be drawn
      }
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
  const docCode = sanitizeText(item.docCode || '-')
  page.drawText(docCode, {
    x: textX,
    y: textY,
    size: 20,  // BIGGER doc code (was 18)
    font: boldFont,
    color: BRAND_COLOR
  })
  textY -= lineHeight

  // ITEM NAME - show prominently below doc code (limit to 2 lines)
  const itemName = item.name || 'Unnamed Item'
  // Wrap name if too long
  const nameMaxWidth = textAreaWidth - 10
  let nameLines = wrapText(itemName, boldFont, 18, nameMaxWidth)
  // Limit name to 2 lines to prevent overflow
  if (nameLines.length > 2) {
    nameLines = nameLines.slice(0, 2)
    nameLines[1] = nameLines[1].slice(0, -3) + '...'
  }
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

  // NOTES - Show in RED, limit to 3 lines to prevent overflow
  if (options.showNotes && item.notes) {
    page.drawText('Notes:', {
      x: textX,
      y: textY,
      size: labelSize,
      font: font,
      color: LABEL_COLOR
    })
    textY -= lineHeight

    // Wrap notes to multiple lines - LIMIT to 3 lines to prevent overflow
    const notesSize = 16  // Bigger notes text
    const notesMaxWidth = textAreaWidth - 20
    let notesLines = wrapText(item.notes, font, notesSize, notesMaxWidth)
    // Limit notes to 3 lines max
    const MAX_NOTE_LINES = 3
    if (notesLines.length > MAX_NOTE_LINES) {
      notesLines = notesLines.slice(0, MAX_NOTE_LINES)
      notesLines[MAX_NOTE_LINES - 1] = notesLines[MAX_NOTE_LINES - 1].slice(0, -3) + '...'
    }
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

// Sanitize text to remove characters that WinAnsi encoding cannot handle
function sanitizeText(text: string): string {
  if (!text) return ''

  // Replace Unicode fractions with ASCII equivalents
  const fractionMap: Record<string, string> = {
    '⅛': '1/8',
    '¼': '1/4',
    '⅜': '3/8',
    '½': '1/2',
    '⅝': '5/8',
    '¾': '3/4',
    '⅞': '7/8',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅕': '1/5',
    '⅖': '2/5',
    '⅗': '3/5',
    '⅘': '4/5',
    '⅙': '1/6',
    '⅚': '5/6',
  }

  let sanitized = text
  for (const [unicode, ascii] of Object.entries(fractionMap)) {
    sanitized = sanitized.replace(new RegExp(unicode, 'g'), ascii)
  }

  // Replace other common problematic Unicode characters
  sanitized = sanitized
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/\u2014/g, '-')          // Em dash
    .replace(/\u2013/g, '-')          // En dash
    .replace(/\u2026/g, '...')        // Ellipsis
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')  // Bullet points
    .replace(/\u00B0/g, ' deg')       // Degree symbol
    .replace(/\u00D7/g, 'x')          // Multiplication sign
    .replace(/[\n\r\t]/g, ' ')        // Newlines, carriage returns, tabs
    .replace(/\s+/g, ' ')             // Collapse multiple spaces
    .trim()

  // Remove any remaining non-WinAnsi characters (keep basic ASCII + extended Latin)
  // WinAnsi supports characters 0x20-0x7E and 0xA0-0xFF
  sanitized = sanitized.replace(/[^\x20-\x7E\xA0-\xFF]/g, '')

  return sanitized
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let truncated = sanitizeText(text)
  while (font.widthOfTextAtSize(truncated, size) > maxWidth && truncated.length > 3) {
    truncated = truncated.slice(0, -4) + '...'
  }
  return truncated
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  // Sanitize text to handle newlines and other problematic characters
  const sanitized = sanitizeText(text)
  const words = sanitized.split(' ')
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
