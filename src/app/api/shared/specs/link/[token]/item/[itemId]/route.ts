import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public API - no auth required
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; itemId: string }> }
) {
  try {
    const { token, itemId } = await params

    // Find the share link by token
    const shareLink = await prisma.specShareLink.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            organization: {
              select: { name: true }
            }
          }
        }
      }
    })

    // Check if link exists
    if (!shareLink) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    // Check if link is active
    if (!shareLink.active) {
      return NextResponse.json({ error: 'This link has been deactivated' }, { status: 410 })
    }

    // Check if link has expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    // Check if item is in the share link's items
    if (!shareLink.itemIds.includes(itemId)) {
      return NextResponse.json({ error: 'Item not found in this share link' }, { status: 404 })
    }

    // Fetch the item
    const item = await prisma.roomFFEItem.findUnique({
      where: { id: itemId },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            instance: {
              select: {
                room: {
                  select: {
                    id: true,
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get all items for navigation (previous/next)
    const allItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: shareLink.itemIds },
        visibility: 'VISIBLE'
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { order: 'asc' }
    })

    const currentIndex = allItems.findIndex(i => i.id === itemId)
    const previousItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
    const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

    // Transform item based on visibility settings
    const room = item.section?.instance?.room
    const spec = {
      id: item.id,
      name: item.name,
      description: item.description,
      roomName: room?.name || room?.type?.replace(/_/g, ' ') || 'Room',
      roomType: room?.type,
      sectionName: item.section?.name || '',
      categoryName: item.section?.name || '',
      productName: item.modelNumber,
      brand: shareLink.showBrand ? item.brand : null,
      sku: item.sku,
      modelNumber: item.modelNumber,
      supplierName: shareLink.showSupplier ? item.supplierName : null,
      supplierLink: shareLink.showSupplier ? item.supplierLink : null,
      quantity: item.quantity,
      leadTime: item.leadTime,
      specStatus: item.specStatus,
      images: item.images || [],
      thumbnailUrl: (item.images as string[])?.[0] || null,
      color: shareLink.showDetails ? item.color : null,
      finish: shareLink.showDetails ? item.finish : null,
      material: shareLink.showDetails ? item.material : null,
      width: shareLink.showDetails ? item.width : null,
      length: shareLink.showDetails ? item.length : null,
      height: shareLink.showDetails ? item.height : null,
      depth: shareLink.showDetails ? item.depth : null,
      tradePrice: shareLink.showPricing ? item.tradePrice : null,
      rrp: shareLink.showPricing ? item.rrp : null,
      updatedAt: item.updatedAt
    }

    return NextResponse.json({
      success: true,
      linkName: shareLink.name,
      projectName: shareLink.project.name,
      orgName: shareLink.project.organization?.name || '',
      item: spec,
      navigation: {
        previous: previousItem ? { id: previousItem.id, name: previousItem.name } : null,
        next: nextItem ? { id: nextItem.id, name: nextItem.name } : null,
        currentIndex: currentIndex + 1,
        totalItems: allItems.length
      },
      shareSettings: {
        showSupplier: shareLink.showSupplier,
        showBrand: shareLink.showBrand,
        showPricing: shareLink.showPricing,
        showDetails: shareLink.showDetails
      }
    })

  } catch (error) {
    console.error('Error fetching shared spec item:', error)
    return NextResponse.json(
      { error: 'Failed to load item' },
      { status: 500 }
    )
  }
}

