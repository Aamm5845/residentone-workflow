import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public API - no auth required
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    const { projectId, itemId } = await params

    // Get project with share settings
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        shareSettings: true,
        organization: {
          select: { name: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if sharing is enabled
    const shareSettings = project.shareSettings as any
    if (!shareSettings?.isPublished) {
      return NextResponse.json({ error: 'This schedule is not published' }, { status: 403 })
    }

    // Fetch the item
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

    // Verify item belongs to this project
    if (item.room?.projectId !== projectId) {
      return NextResponse.json({ error: 'Item not found in this project' }, { status: 404 })
    }

    // Get all visible items for navigation
    const allItems = await prisma.roomFFEItem.findMany({
      where: {
        room: {
          projectId: projectId
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

    const currentIndex = allItems.findIndex(i => i.id === itemId)
    const previousItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
    const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

    // Transform item
    const spec = {
      id: item.id,
      name: item.name,
      description: item.description,
      roomName: item.room?.name || item.room?.type?.replace(/_/g, ' ') || 'Room',
      roomType: item.room?.type,
      sectionName: item.section?.name || '',
      categoryName: item.section?.name || '',
      productName: item.modelNumber,
      brand: item.brand,
      sku: item.sku,
      modelNumber: item.modelNumber,
      supplierName: item.supplierName,
      supplierLink: item.supplierLink,
      quantity: item.quantity,
      leadTime: item.leadTime,
      specStatus: item.specStatus,
      images: item.images || [],
      thumbnailUrl: (item.images as string[])?.[0] || null,
      color: item.color,
      finish: item.finish,
      material: item.material,
      width: item.width,
      length: item.length,
      height: item.height,
      depth: item.depth,
      tradePrice: shareSettings.showPricing ? item.tradePrice : null,
      rrp: shareSettings.showPricing ? item.rrp : null,
      updatedAt: item.updatedAt
    }

    return NextResponse.json({
      success: true,
      projectName: project.name,
      orgName: project.organization?.name || '',
      item: spec,
      navigation: {
        previous: previousItem ? { id: previousItem.id, name: previousItem.name } : null,
        next: nextItem ? { id: nextItem.id, name: nextItem.name } : null,
        currentIndex: currentIndex + 1,
        totalItems: allItems.length
      },
      shareSettings: {
        showSupplier: shareSettings.showSupplier ?? false,
        showBrand: shareSettings.showBrand ?? true,
        showPricing: shareSettings.showPricing ?? false,
        showDetails: shareSettings.showDetails ?? true
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

