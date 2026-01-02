import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

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
                room: {
                  select: { name: true }
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

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // Parse the Excel structure
    let currentCategory = 'Uncategorized'
    let headerRowIndex = -1
    const items: any[] = []
    const importBatchId = `import-${Date.now()}`

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const firstCell = String(row[0] || '').trim()

      // Check for section header
      if (firstCell.startsWith('Section :')) {
        currentCategory = firstCell.replace('Section :', '').trim()
        continue
      }

      // Check for column headers row
      if (firstCell === 'Image' && row[1] === 'Product Description') {
        headerRowIndex = i
        continue
      }

      // Skip non-data rows
      if (headerRowIndex === -1) continue
      if (firstCell === 'Meisner Interiors') continue
      if (firstCell.startsWith('Project :')) continue
      if (firstCell.startsWith('Schedule :')) continue

      // Parse data row
      const description = row[1] ? String(row[1]).trim() : null
      const productName = row[3] ? String(row[3]).trim() : null

      // Skip empty rows or rows with just dashes
      if ((!description || description === '-') && (!productName || productName === '-')) {
        continue
      }

      // Parse numbers safely
      const parseNumber = (val: any): number | null => {
        if (val === null || val === undefined || val === '-' || val === '') return null
        const num = parseFloat(String(val).replace(/[,$]/g, ''))
        return isNaN(num) ? null : num
      }

      items.push({
        orgId,
        category: currentCategory,
        name: productName || description || 'Unknown Item',
        description: description,
        details: row[2] ? String(row[2]).trim() : null,
        brand: row[4] && row[4] !== '-' ? String(row[4]).trim() : null,
        docCode: row[5] && row[5] !== '-' ? String(row[5]).trim() : null,
        sku: row[6] && row[6] !== '-' ? String(row[6]).trim() : null,
        color: row[7] && row[7] !== '-' ? String(row[7]).trim() : null,
        finish: row[8] && row[8] !== '-' ? String(row[8]).trim() : null,
        material: row[9] && row[9] !== '-' ? String(row[9]).trim() : null,
        width: row[10] && row[10] !== '-' ? String(row[10]).trim() : null,
        length: row[11] && row[11] !== '-' ? String(row[11]).trim() : null,
        height: row[12] && row[12] !== '-' ? String(row[12]).trim() : null,
        depth: row[13] && row[13] !== '-' ? String(row[13]).trim() : null,
        leadTime: row[14] && row[14] !== '-' ? String(row[14]).trim() : null,
        quantity: parseNumber(row[15]) || 0,
        rrp: parseNumber(row[16]),
        tradePrice: parseNumber(row[17]),
        tradeDiscount: parseNumber(row[18]),
        totalCost: parseNumber(row[19]),
        markup: parseNumber(row[20]),
        clientPriceExc: parseNumber(row[21]),
        taxAmount: parseNumber(row[22]),
        clientPriceInc: parseNumber(row[23]),
        clientDiscount: parseNumber(row[24]),
        profit: parseNumber(row[25]),
        supplierCompanyName: row[26] && row[26] !== '-' ? String(row[26]).trim() : null,
        supplierName: row[27] && row[27] !== '-' ? String(row[27]).trim() : null,
        supplierEmail: row[28] && row[28] !== '-' ? String(row[28]).trim() : null,
        supplierPhone: row[29] ? String(row[29]).trim() : null,
        supplierAddress: row[30] && row[30] !== '-' ? String(row[30]).trim() : null,
        websiteUrl: row[31] && row[31] !== '-' ? String(row[31]).trim() : null,
        status: row[32] && row[32] !== '-' ? String(row[32]).trim() : 'draft',
        importantInfo: row[33] && row[33] !== '-' ? String(row[33]).trim() : null,
        notes: row[34] && row[34] !== '-' ? String(row[34]).trim() : null,
        importBatchId,
        rowNumber: i
      })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found in Excel file' }, { status: 400 })
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
