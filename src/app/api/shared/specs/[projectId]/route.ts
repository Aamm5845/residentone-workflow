import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public API - no auth required
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params
    const { projectId } = resolvedParams

    // Get project with share settings
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        shareSettings: true,
        organization: {
          select: {
            name: true
          }
        },
        rooms: {
          select: {
            id: true,
            name: true,
            type: true,
            ffeInstance: {
              select: {
                sections: {
                  select: {
                    id: true,
                    name: true,
                    items: {
                      where: {
                        visibility: 'VISIBLE',
                        // Only show actual specs - exclude FFE Workspace task items
                        specStatus: {
                          notIn: ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
                        }
                      },
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        brand: true,
                        sku: true,
                        modelNumber: true,
                        supplierName: true,
                        supplierLink: true,
                        quantity: true,
                        leadTime: true,
                        specStatus: true,
                        images: true,
                        color: true,
                        finish: true,
                        material: true,
                        width: true,
                        height: true,
                        depth: true,
                        tradePrice: true,
                        rrp: true
                      },
                      orderBy: { order: 'asc' }
                    }
                  },
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
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

    // Transform specs data - only include actual specs (not FFE workspace tasks)
    const taskStatuses = ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
    
    const allItems = project.rooms.flatMap(room => 
      room.ffeInstance?.sections.flatMap(section =>
        section.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          roomName: room.name || room.type?.replace(/_/g, ' ') || 'Room',
          roomType: room.type,
          sectionName: section.name,
          categoryName: section.name,
          productName: item.modelNumber,
          brand: item.brand,
          sku: item.sku,
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
          height: item.height,
          depth: item.depth,
          tradePrice: shareSettings.showPricing ? item.tradePrice : null,
          rrp: shareSettings.showPricing ? item.rrp : null
        }))
      ) || []
    )
    
    // Filter to only show actual specs - same logic as All Specs view
    const specs = allItems.filter(spec => {
      // Exclude FFE Workspace task statuses
      if (!spec.specStatus || taskStatuses.includes(spec.specStatus)) {
        return false
      }
      return true
    })

    return NextResponse.json({
      success: true,
      projectName: project.name,
      orgName: project.organization?.name || '',
      specs,
      shareSettings: {
        showSupplier: shareSettings.showSupplier ?? false,
        showBrand: shareSettings.showBrand ?? true,
        showPricing: shareSettings.showPricing ?? false,
        showDetails: shareSettings.showDetails ?? true
      }
    })

  } catch (error) {
    console.error('Error fetching shared specs:', error)
    return NextResponse.json(
      { error: 'Failed to load specifications' },
      { status: 500 }
    )
  }
}



