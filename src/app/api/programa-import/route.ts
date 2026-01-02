import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { put } from '@vercel/blob'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'

/**
 * Extract embedded images from Excel file
 * Excel files (xlsx) are ZIP archives containing images in xl/media folder
 * Returns a map of data row index (1-based, excluding header) to image URL
 */
async function extractImagesFromExcel(buffer: Buffer): Promise<Map<number, string>> {
  const imageMap = new Map<number, string>()
  const uploadedImages: { fileName: string, url: string }[] = []

  try {
    const zip = await JSZip.loadAsync(buffer)

    // List all files in the zip for debugging
    const allFiles = Object.keys(zip.files)
    console.log(`[programa-import] ZIP contains ${allFiles.length} files`)
    const drawingFiles = allFiles.filter(f => f.includes('drawing'))
    console.log(`[programa-import] Drawing files: ${drawingFiles.join(', ')}`)

    // Get drawing relationships to map rId to image filename
    const drawingRels: Map<string, string> = new Map()

    // Try to find any rels file for drawings
    for (const filePath of allFiles) {
      if (filePath.includes('drawings') && filePath.includes('.rels')) {
        const relsFile = zip.file(filePath)
        if (relsFile) {
          const relsContent = await relsFile.async('text')
          console.log(`[programa-import] Found rels file: ${filePath}`)
          // Parse relationships
          const relMatches = relsContent.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)
          for (const match of relMatches) {
            const rId = match[1]
            const target = match[2].replace('../media/', '').replace('media/', '')
            drawingRels.set(rId, target)
            console.log(`[programa-import] Rel: ${rId} -> ${target}`)
          }
        }
      }
    }

    // Find row-to-image mapping from drawing XML
    const rowToRId: Map<number, string> = new Map()

    for (const filePath of allFiles) {
      if (filePath.includes('drawings/drawing') && filePath.endsWith('.xml') && !filePath.includes('_rels')) {
        const drawingFile = zip.file(filePath)
        if (drawingFile) {
          const drawingContent = await drawingFile.async('text')
          console.log(`[programa-import] Parsing drawing file: ${filePath}`)

          // Try multiple regex patterns for different Excel formats
          // Pattern 1: Standard twoCellAnchor/oneCellAnchor
          let anchorMatches = drawingContent.matchAll(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?<\/xdr:from>[\s\S]*?r:embed="(rId\d+)"/g)
          for (const match of anchorMatches) {
            const row = parseInt(match[1])
            const rId = match[2]
            rowToRId.set(row, rId)
            console.log(`[programa-import] Found anchor: row ${row} -> ${rId}`)
          }

          // Pattern 2: Alternative format
          if (rowToRId.size === 0) {
            anchorMatches = drawingContent.matchAll(/<xdr:row>(\d+)<\/xdr:row>[\s\S]*?embed="(rId\d+)"/g)
            for (const match of anchorMatches) {
              const row = parseInt(match[1])
              const rId = match[2]
              rowToRId.set(row, rId)
              console.log(`[programa-import] Found anchor (alt): row ${row} -> ${rId}`)
            }
          }
        }
      }
    }

    // Extract and upload images from xl/media folder
    const mediaFiles = allFiles
      .filter(f => f.startsWith('xl/media/') || f.startsWith('media/'))
      .sort()

    console.log(`[programa-import] Found ${mediaFiles.length} media files`)

    for (const filePath of mediaFiles) {
      const file = zip.file(filePath)
      if (!file) continue

      const imageBuffer = await file.async('nodebuffer')
      const fileName = filePath.split('/').pop() || 'image.png'
      const ext = fileName.split('.').pop()?.toLowerCase() || 'png'

      // Skip non-image files
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) continue

      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                          ext === 'png' ? 'image/png' :
                          ext === 'gif' ? 'image/gif' : 'image/png'

      // Upload to Vercel Blob
      const blobFileName = `programa-imports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const blob = await put(blobFileName, imageBuffer, { access: 'public', contentType })

      uploadedImages.push({ fileName, url: blob.url })
      console.log(`[programa-import] Uploaded: ${fileName} -> ${blob.url}`)
    }

    // Build filename to URL map
    const fileNameToUrl: Map<string, string> = new Map()
    for (const img of uploadedImages) {
      fileNameToUrl.set(img.fileName, img.url)
    }

    // Map rows to images using the drawing relationships
    for (const [row, rId] of rowToRId.entries()) {
      const fileName = drawingRels.get(rId)
      if (fileName) {
        const url = fileNameToUrl.get(fileName)
        if (url) {
          imageMap.set(row, url)
          console.log(`[programa-import] Mapped Excel row ${row} -> ${fileName} -> ${url.substring(0, 50)}...`)
        }
      }
    }

    // If no proper mapping was found, use sequential assignment
    // This assigns images in order: image 1 to data row 1, image 2 to data row 2, etc.
    if (imageMap.size === 0 && uploadedImages.length > 0) {
      console.log('[programa-import] No row mapping found, using sequential assignment')
      for (let i = 0; i < uploadedImages.length; i++) {
        // Use i+1 for 1-based data row index (row 1 = first data row after header)
        imageMap.set(i + 1, uploadedImages[i].url)
        console.log(`[programa-import] Sequential: data row ${i + 1} -> ${uploadedImages[i].url.substring(0, 50)}...`)
      }
    }

    console.log(`[programa-import] Final mapping has ${imageMap.size} entries for keys: ${Array.from(imageMap.keys()).join(', ')}`)
  } catch (error) {
    console.error('[programa-import] Error extracting images:', error)
  }

  return imageMap
}

/**
 * GET /api/programa-import
 * Get all programa items with optional category filter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const linkedOnly = searchParams.get('linked') === 'true'
    const unlinkedOnly = searchParams.get('unlinked') === 'true'

    const items = await prisma.programaItem.findMany({
      where: {
        orgId,
        ...(category ? { category } : {}),
        ...(linkedOnly ? { linkedRoomFFEItemId: { not: null } } : {}),
        ...(unlinkedOnly ? { linkedRoomFFEItemId: null } : {})
      },
      include: {
        linkedRoomFFEItem: {
          select: {
            id: true,
            name: true,
            images: true,
            section: {
              select: {
                name: true,
                instance: {
                  select: {
                    room: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        },
        linkedBy: {
          select: { name: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { rowNumber: 'asc' }
      ]
    })

    // Get unique categories
    const categories = await prisma.programaItem.findMany({
      where: { orgId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    })

    // Stats
    const totalCount = await prisma.programaItem.count({ where: { orgId } })
    const linkedCount = await prisma.programaItem.count({
      where: { orgId, linkedRoomFFEItemId: { not: null } }
    })

    return NextResponse.json({
      items,
      categories: categories.map(c => c.category),
      stats: {
        total: totalCount,
        linked: linkedCount,
        unlinked: totalCount - linkedCount
      }
    })
  } catch (error) {
    console.error('Error fetching programa items:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

/**
 * POST /api/programa-import
 * Import items from Excel file
 * Supports two formats:
 * 1. Simple format with header row: Image, Product Name, Description, Brand, SKU, Colour, Finish, Material, Width, Length, Height, Depth, Quantity, RRP, Website URL, Notes
 * 2. Legacy Programa format with "Section :" headers
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clearExisting = formData.get('clearExisting') === 'true'
    const defaultCategory = formData.get('category') as string || 'Imported'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // Extract embedded images from Excel
    console.log('[programa-import] Extracting embedded images...')
    const imageMap = await extractImagesFromExcel(buffer)
    console.log(`[programa-import] Found ${imageMap.size} embedded images`)

    const items: any[] = []
    const importBatchId = `import-${Date.now()}`

    // Parse numbers safely
    const parseNumber = (val: any): number | null => {
      if (val === null || val === undefined || val === '-' || val === '') return null
      const num = parseFloat(String(val).replace(/[,$]/g, ''))
      return isNaN(num) ? null : num
    }

    const cleanValue = (val: any): string | null => {
      if (val === null || val === undefined || val === '-' || val === '') return null
      return String(val).trim()
    }

    // Detect format by checking first row headers
    const firstRow = data[0] || []
    const firstCellLower = String(firstRow[0] || '').toLowerCase().trim()
    const secondCellLower = String(firstRow[1] || '').toLowerCase().trim()

    console.log(`[programa-import] First cell: "${firstRow[0]}", Second cell: "${firstRow[1]}"`)

    // Check if it's the legacy Programa format (has specific header pattern)
    const isLegacyFormat = firstCellLower === 'image' && secondCellLower === 'product description'

    // Check if it's the simple format (has header row with known columns)
    const isSimpleFormat = !isLegacyFormat && (
      firstCellLower === 'image' ||
      firstCellLower === 'product image' ||
      firstCellLower === 'product name' ||
      (firstRow[1] && String(firstRow[1]).toLowerCase().includes('name'))
    )

    console.log(`[programa-import] Format detected: ${isLegacyFormat ? 'LEGACY' : isSimpleFormat ? 'SIMPLE' : 'UNKNOWN'}`)

    if (isSimpleFormat) {
      // Simple format: header row followed by data rows
      // Expected columns: Image, Product Name, Description, Brand, SKU/Model, Colour, Finish, Material, Width, Length, Height, Depth, Quantity, RRP, Website URL, Notes

      // Find header row and map column indices
      let headerRowIndex = 0
      const headers = data[headerRowIndex].map((h: any) => String(h || '').toLowerCase().trim())

      // Map column names to indices (flexible matching)
      const getColIndex = (names: string[]): number => {
        for (const name of names) {
          const idx = headers.findIndex((h: string) => h.includes(name))
          if (idx !== -1) return idx
        }
        return -1
      }

      const colMap = {
        image: getColIndex(['image', 'photo', 'picture', 'img']),
        name: getColIndex(['product name', 'name', 'item name', 'product']),
        description: getColIndex(['description', 'desc', 'product description']),
        brand: getColIndex(['brand', 'manufacturer']),
        sku: getColIndex(['sku', 'model', 'model number', 'item code', 'code']),
        color: getColIndex(['colour', 'color']),
        finish: getColIndex(['finish']),
        material: getColIndex(['material']),
        width: getColIndex(['width', 'w']),
        length: getColIndex(['length', 'l']),
        height: getColIndex(['height', 'h']),
        depth: getColIndex(['depth', 'd']),
        quantity: getColIndex(['quantity', 'qty']),
        rrp: getColIndex(['rrp', 'price', 'retail price', 'cost']),
        websiteUrl: getColIndex(['website', 'url', 'link', 'website url']),
        notes: getColIndex(['notes', 'note', 'comments', 'comment']),
        category: getColIndex(['category', 'section', 'type'])
      }

      // Process data rows (skip header)
      let dataRowIndex = 0
      for (let i = 1; i < data.length; i++) {
        const row = data[i]
        if (!row || row.length === 0) continue

        // Get product name - skip if empty
        const productName = colMap.name >= 0 ? cleanValue(row[colMap.name]) : null
        if (!productName) continue

        dataRowIndex++

        // Determine category
        let category = defaultCategory
        if (colMap.category >= 0 && row[colMap.category]) {
          category = cleanValue(row[colMap.category]) || defaultCategory
        }

        // Get image - first try URL from cell, then try extracted embedded image
        let imageUrl = colMap.image >= 0 ? cleanValue(row[colMap.image]) : null
        if (!imageUrl || !imageUrl.startsWith('http')) {
          // Excel drawing XML uses 0-indexed row numbers
          // Our loop index 'i' matches the data array index, which equals the Excel row number (0-indexed)
          // So imageMap.get(i) should find the image for this row
          imageUrl = imageMap.get(i) || null
          if (imageUrl) {
            console.log(`[programa-import] Found image for row ${i}: ${imageUrl.substring(0, 50)}...`)
          }
        }

        items.push({
          orgId,
          category,
          imageUrl,
          name: productName,
          description: colMap.description >= 0 ? cleanValue(row[colMap.description]) : null,
          brand: colMap.brand >= 0 ? cleanValue(row[colMap.brand]) : null,
          sku: colMap.sku >= 0 ? cleanValue(row[colMap.sku]) : null,
          color: colMap.color >= 0 ? cleanValue(row[colMap.color]) : null,
          finish: colMap.finish >= 0 ? cleanValue(row[colMap.finish]) : null,
          material: colMap.material >= 0 ? cleanValue(row[colMap.material]) : null,
          width: colMap.width >= 0 ? cleanValue(row[colMap.width]) : null,
          length: colMap.length >= 0 ? cleanValue(row[colMap.length]) : null,
          height: colMap.height >= 0 ? cleanValue(row[colMap.height]) : null,
          depth: colMap.depth >= 0 ? cleanValue(row[colMap.depth]) : null,
          quantity: colMap.quantity >= 0 ? (parseNumber(row[colMap.quantity]) || 0) : 0,
          rrp: colMap.rrp >= 0 ? parseNumber(row[colMap.rrp]) : null,
          websiteUrl: colMap.websiteUrl >= 0 ? cleanValue(row[colMap.websiteUrl]) : null,
          notes: colMap.notes >= 0 ? cleanValue(row[colMap.notes]) : null,
          importBatchId,
          rowNumber: i
        })
      }
    } else {
      // Legacy/Custom format - find header row and use dynamic column detection
      let currentCategory = defaultCategory
      let headerRowIndex = -1
      let colMap: Record<string, number> = {}

      // First pass: find header row and build column map
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (!row || row.length === 0) continue

        const firstCell = String(row[0] || '').trim().toLowerCase()

        // Check if this row looks like a header (has "image" or "product" in first few cells)
        if (firstCell === 'image' || firstCell.includes('product')) {
          headerRowIndex = i
          // Build column map from header row
          const headers = row.map((h: any) => String(h || '').toLowerCase().trim())

          const getColIndex = (names: string[]): number => {
            for (const name of names) {
              const idx = headers.findIndex((h: string) => h.includes(name))
              if (idx !== -1) return idx
            }
            return -1
          }

          colMap = {
            image: getColIndex(['image', 'photo', 'picture']),
            name: getColIndex(['product name', 'name', 'item name', 'product']),
            description: getColIndex(['description', 'desc', 'product description']),
            brand: getColIndex(['brand', 'manufacturer']),
            sku: getColIndex(['sku', 'model', 'model number', 'item code', 'code']),
            color: getColIndex(['colour', 'color']),
            finish: getColIndex(['finish']),
            material: getColIndex(['material']),
            width: getColIndex(['width', 'w']),
            length: getColIndex(['length', 'l']),
            height: getColIndex(['height', 'h']),
            depth: getColIndex(['depth', 'd']),
            quantity: getColIndex(['quantity', 'qty']),
            rrp: getColIndex(['rrp', 'price', 'retail price', 'cost']),
            websiteUrl: getColIndex(['website', 'url', 'link', 'website url']),
            notes: getColIndex(['notes', 'note', 'comments', 'comment']),
            category: getColIndex(['category', 'section', 'type'])
          }

          console.log(`[programa-import] Found header row at ${i}, column map:`, colMap)
          break
        }
      }

      // Second pass: process data rows
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (!row || row.length === 0) continue

        const firstCell = String(row[0] || '').trim()

        // Check for section header
        if (firstCell.startsWith('Section :')) {
          currentCategory = firstCell.replace('Section :', '').trim()
          continue
        }

        // Skip header and rows before header
        if (i <= headerRowIndex) continue
        if (firstCell === 'Meisner Interiors') continue
        if (firstCell.startsWith('Project :')) continue
        if (firstCell.startsWith('Schedule :')) continue

        // Get product name from mapped column or fallback positions
        const productName = colMap.name >= 0 ? cleanValue(row[colMap.name]) : (cleanValue(row[3]) || cleanValue(row[1]))
        const description = colMap.description >= 0 ? cleanValue(row[colMap.description]) : cleanValue(row[1])

        // Skip empty rows
        if (!productName && !description) continue

        // Get embedded image for this row
        const imageUrl = imageMap.get(i) || null
        if (imageUrl) {
          console.log(`[programa-import] Legacy format: Found image for row ${i}`)
        }

        // Determine category
        let category = currentCategory
        if (colMap.category >= 0 && row[colMap.category]) {
          category = cleanValue(row[colMap.category]) || currentCategory
        }

        items.push({
          orgId,
          category,
          imageUrl,
          name: productName || description || 'Unknown Item',
          description: description,
          brand: colMap.brand >= 0 ? cleanValue(row[colMap.brand]) : cleanValue(row[4]),
          sku: colMap.sku >= 0 ? cleanValue(row[colMap.sku]) : cleanValue(row[6]),
          color: colMap.color >= 0 ? cleanValue(row[colMap.color]) : cleanValue(row[7]),
          finish: colMap.finish >= 0 ? cleanValue(row[colMap.finish]) : cleanValue(row[8]),
          material: colMap.material >= 0 ? cleanValue(row[colMap.material]) : cleanValue(row[9]),
          width: colMap.width >= 0 ? cleanValue(row[colMap.width]) : cleanValue(row[10]),
          length: colMap.length >= 0 ? cleanValue(row[colMap.length]) : cleanValue(row[11]),
          height: colMap.height >= 0 ? cleanValue(row[colMap.height]) : cleanValue(row[12]),
          depth: colMap.depth >= 0 ? cleanValue(row[colMap.depth]) : cleanValue(row[13]),
          quantity: colMap.quantity >= 0 ? (parseNumber(row[colMap.quantity]) || 0) : (parseNumber(row[15]) || 0),
          rrp: colMap.rrp >= 0 ? parseNumber(row[colMap.rrp]) : parseNumber(row[16]),
          websiteUrl: colMap.websiteUrl >= 0 ? cleanValue(row[colMap.websiteUrl]) : cleanValue(row[31]),
          notes: colMap.notes >= 0 ? cleanValue(row[colMap.notes]) : cleanValue(row[34]),
          importBatchId,
          rowNumber: i
        })
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found in Excel file. Make sure you have a header row with column names like "Product Name", "Description", etc.' }, { status: 400 })
    }

    // Debug: log items with images
    const itemsWithImages = items.filter(item => item.imageUrl)
    console.log(`[programa-import] Total items: ${items.length}, Items with images: ${itemsWithImages.length}`)
    if (itemsWithImages.length > 0) {
      console.log(`[programa-import] First item with image:`, itemsWithImages[0])
    }

    // Clear existing items if requested
    if (clearExisting) {
      await prisma.programaItem.deleteMany({ where: { orgId } })
    }

    // Create items in batches
    const created = await prisma.programaItem.createMany({
      data: items,
      skipDuplicates: true
    })

    return NextResponse.json({
      success: true,
      imported: created.count,
      batchId: importBatchId,
      categories: [...new Set(items.map(i => i.category))]
    })
  } catch (error) {
    console.error('Error importing programa items:', error)
    return NextResponse.json({ error: 'Failed to import items' }, { status: 500 })
  }
}

/**
 * DELETE /api/programa-import
 * Delete all programa items or specific batch
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')

    const deleted = await prisma.programaItem.deleteMany({
      where: {
        orgId,
        ...(batchId ? { importBatchId: batchId } : {})
      }
    })

    return NextResponse.json({
      success: true,
      deleted: deleted.count
    })
  } catch (error) {
    console.error('Error deleting programa items:', error)
    return NextResponse.json({ error: 'Failed to delete items' }, { status: 500 })
  }
}
