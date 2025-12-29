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

    // Fetch the item first
    const item = await prisma.roomFFEItem.findUnique({
      where: { id: itemId },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            type: true,
            projectId: true
          }
        },
        section: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if item belongs to the project and is in the share link's items
    // If itemIds is empty, we allow all items from the project
    const hasItemIds = shareLink.itemIds && shareLink.itemIds.length > 0
    
    if (hasItemIds) {
      // Specific items are selected - check if this item is in the list
      if (!shareLink.itemIds.includes(itemId)) {
        return NextResponse.json({ error: 'Item not found in this share link' }, { status: 404 })
      }
    } else {
      // No specific items - verify item belongs to the project
      if (item.room?.projectId !== shareLink.projectId) {
        return NextResponse.json({ error: 'Item not found in this share link' }, { status: 404 })
      }
    }

    // Get all items for navigation (previous/next)
    // If itemIds is set, use those; otherwise get all visible items from project
    let allItems
    if (hasItemIds) {
      allItems = await prisma.roomFFEItem.findMany({
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
    } else {
      allItems = await prisma.roomFFEItem.findMany({
        where: {
          room: {
            projectId: shareLink.projectId
          },
          visibility: 'VISIBLE',
          specStatus: {
            notIn: ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
          }
        },
        select: {
          id: true,
          name: true
        },
        orderBy: { order: 'asc' }
      })
    }

    const currentIndex = allItems.findIndex(i => i.id === itemId)
    const previousItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
    const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

    // Transform item based on visibility settings
    const spec = {
      id: item.id,
      name: item.name,
      description: item.description,
      roomName: item.room?.name || item.room?.type?.replace(/_/g, ' ') || 'Room',
      roomType: item.room?.type,
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

