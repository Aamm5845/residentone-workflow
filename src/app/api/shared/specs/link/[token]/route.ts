import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

// Public API - no auth required
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const headersList = await headers()
    const viewedAt = new Date()

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

    // Update tracking
    await prisma.specShareLink.update({
      where: { id: shareLink.id },
      data: {
        viewedAt: shareLink.viewedAt || viewedAt,
        lastAccessedAt: viewedAt,
        accessCount: { increment: 1 }
      }
    })

    // Fetch items - if itemIds is set, use those; otherwise get all visible items from project
    const hasItemIds = shareLink.itemIds && shareLink.itemIds.length > 0
    
    let items
    if (hasItemIds) {
      items = await prisma.roomFFEItem.findMany({
        where: {
          id: { in: shareLink.itemIds },
          visibility: 'VISIBLE'
        },
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
        },
        orderBy: { order: 'asc' }
      })
    } else {
      // No specific items selected - get all visible specs from the project
      items = await prisma.roomFFEItem.findMany({
        where: {
          section: {
            instance: {
              room: {
                projectId: shareLink.projectId
              }
            }
          },
          visibility: 'VISIBLE',
          specStatus: {
            notIn: ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
          }
        },
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
        },
        orderBy: { order: 'asc' }
      })
    }

    // Get last updated time from items
    const lastUpdated = items.length > 0
      ? items.reduce((latest, item) => {
          const itemDate = item.updatedAt || item.createdAt
          return itemDate > latest ? itemDate : latest
        }, items[0].updatedAt || items[0].createdAt)
      : shareLink.updatedAt

    // Transform items based on visibility settings
    const specs = items.map(item => {
      const room = item.section?.instance?.room
      return {
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
      supplierLink: item.supplierLink,
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
      rrp: shareLink.showPricing ? item.rrp : null
      }
    })

    return NextResponse.json({
      success: true,
      linkName: shareLink.name,
      projectName: shareLink.project.name,
      orgName: shareLink.project.organization?.name || '',
      specs,
      shareSettings: {
        showSupplier: shareLink.showSupplier,
        showBrand: shareLink.showBrand,
        showPricing: shareLink.showPricing,
        showDetails: shareLink.showDetails
      },
      expiresAt: shareLink.expiresAt,
      lastUpdated: lastUpdated?.toISOString() || null
    })

  } catch (error) {
    console.error('Error fetching shared specs link:', error)
    return NextResponse.json(
      { error: 'Failed to load specifications' },
      { status: 500 }
    )
  }
}
