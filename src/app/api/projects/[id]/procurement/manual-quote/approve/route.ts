import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

interface ApproveItem {
  specItemId: string
  unitPrice: number
  quantity: number
  leadTime?: string
}

/**
 * POST /api/projects/[id]/procurement/manual-quote/approve
 * Approve a manual quote and update trade prices on spec items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const userId = (session.user as any).id
    const body = await request.json()

    const {
      supplierId,
      supplierName,
      fileUrl,
      supplierInfo,
      items
    }: {
      supplierId: string
      supplierName: string
      fileUrl: string
      supplierInfo: any
      items: ApproveItem[]
    } = body

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'supplierId and items are required' },
        { status: 400 }
      )
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify supplier exists and belongs to org
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, orgId },
      select: { id: true, name: true, markupPercent: true }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Get all spec item IDs to verify they exist
    const specItemIds = items.map(i => i.specItemId)
    const specItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: specItemIds },
        room: { projectId }
      },
      select: {
        id: true,
        name: true,
        supplierId: true,
        supplierName: true,
        tradePrice: true
      }
    })

    if (specItems.length !== specItemIds.length) {
      return NextResponse.json(
        { error: 'Some spec items not found or do not belong to this project' },
        { status: 400 }
      )
    }

    // Create a map for quick lookup
    const specItemMap = new Map(specItems.map(s => [s.id, s]))

    // Get supplier's markup percentage (default to 25% if not set)
    const supplierMarkup = supplier.markupPercent
      ? Number(supplier.markupPercent)
      : 25

    // Track items that had supplier changes
    const supplierChanges: Array<{
      itemName: string
      previousSupplier: string
      newSupplier: string
    }> = []

    // Track items that had price confirmations needed
    const priceUpdates: Array<{
      itemName: string
      previousPrice: number | null
      newPrice: number
    }> = []

    // Update each spec item with trade price
    for (const item of items) {
      const specItem = specItemMap.get(item.specItemId)
      if (!specItem) continue

      const tradePrice = item.unitPrice

      // Check if supplier is changing
      if (specItem.supplierId && specItem.supplierId !== supplierId) {
        supplierChanges.push({
          itemName: specItem.name,
          previousSupplier: specItem.supplierName || 'Unknown',
          newSupplier: supplierName
        })
      }

      // Check if price is being updated
      if (specItem.tradePrice) {
        priceUpdates.push({
          itemName: specItem.name,
          previousPrice: Number(specItem.tradePrice),
          newPrice: tradePrice
        })
      }

      // Update the spec item with trade price (not RRP - as per user requirement)
      await prisma.roomFFEItem.update({
        where: { id: item.specItemId },
        data: {
          specStatus: 'QUOTE_APPROVED',
          tradePrice: tradePrice,
          tradePriceCurrency: 'CAD', // Default to CAD
          supplierId: supplierId,
          supplierName: supplierName,
          ...(item.leadTime ? { leadTime: item.leadTime } : {})
        }
      })

      // Create activity for the price update
      await prisma.itemActivity.create({
        data: {
          itemId: item.specItemId,
          type: 'PRICE_UPDATED',
          title: 'Manual Quote Approved',
          description: `Trade price set to $${tradePrice.toLocaleString()} from ${supplierName} (manual quote upload)`,
          actorName: (session.user as any).name || 'Team Member',
          actorType: 'user',
          metadata: {
            source: 'manual_quote',
            tradePrice: tradePrice,
            supplierId: supplierId,
            supplierName: supplierName,
            approvedById: userId,
            fileUrl: fileUrl
          }
        }
      })
    }

    // Calculate totals for the response
    const totalTradeValue = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)

    // === DROPBOX INTEGRATION: Upload quote PDF to Dropbox ===
    let dropboxUploadResult: { path?: string; sharedLink?: string } = {}

    try {
      // Get project with dropbox folder
      const projectWithDropbox = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          dropboxFolder: true
        }
      })

      // Only proceed if project has a dropbox folder and there's a file to upload
      if (projectWithDropbox?.dropboxFolder && fileUrl) {
        // Determine category from first matched item's section/category
        // We need to get the category from the spec items
        const firstSpecItem = specItems[0]
        let category = 'General'

        if (firstSpecItem) {
          // Get the room section name for the category
          const roomWithSection = await prisma.roomFFEItem.findUnique({
            where: { id: firstSpecItem.id },
            select: {
              room: {
                select: {
                  section: {
                    select: { name: true }
                  }
                }
              }
            }
          })
          category = roomWithSection?.room?.section?.name || 'General'
        }

        // Download file from the Blob URL
        let fileBuffer: Buffer | null = null
        try {
          const response = await fetch(fileUrl)
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            fileBuffer = Buffer.from(arrayBuffer)
          }
        } catch (fetchError) {
          console.warn('[Manual Quote Approve] Could not download file from URL:', fetchError)
        }

        if (fileBuffer) {
          // Format filename: ManualQuote_SupplierName_2024-01-15.pdf
          const dateStr = new Date().toISOString().split('T')[0]
          const safeSupplierName = (supplierName || 'Supplier')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 30)
          const fileName = `ManualQuote_${safeSupplierName}_${dateStr}.pdf`

          // Upload to Dropbox
          dropboxUploadResult = await dropboxService.uploadShoppingFile(
            projectWithDropbox.dropboxFolder,
            category,
            'Quotes',
            fileName,
            fileBuffer
          )

          console.log(`[Manual Quote Approve] Quote PDF uploaded to Dropbox: ${dropboxUploadResult.path}`)
        }
      }
    } catch (dropboxError) {
      // Non-fatal: log error but continue
      console.error('[Manual Quote Approve] Dropbox upload failed (non-fatal):', dropboxError)
    }
    // === END DROPBOX INTEGRATION ===

    return NextResponse.json({
      success: true,
      message: `Updated ${items.length} items with trade prices`,
      summary: {
        itemsUpdated: items.length,
        totalTradeValue,
        supplierChanges: supplierChanges.length,
        priceUpdates: priceUpdates.length
      },
      supplierChanges: supplierChanges.length > 0 ? supplierChanges : undefined,
      priceUpdates: priceUpdates.length > 0 ? priceUpdates : undefined,
      dropbox: dropboxUploadResult.path ? {
        path: dropboxUploadResult.path,
        sharedLink: dropboxUploadResult.sharedLink
      } : undefined
    })

  } catch (error: any) {
    console.error('[Manual Quote Approve] Error:', error)
    return NextResponse.json(
      { error: 'Failed to approve quote', message: error?.message },
      { status: 500 }
    )
  }
}
