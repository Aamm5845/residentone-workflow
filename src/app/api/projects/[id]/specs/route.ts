import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/specs
 * Get all FFE items/specs for a project
 */
export async function GET(
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

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms with their FFE instance, sections, and items
    const rooms = await prisma.room.findMany({
      where: { projectId },
      include: {
        ffeInstance: {
          include: {
            sections: {
              include: {
                items: {
                  include: {
                    libraryProduct: {
                      include: {
                        category: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    // Flatten and transform the data - include all needed fields for section actions
    const specs = rooms.flatMap(room => 
      room.ffeInstance ? room.ffeInstance.sections.flatMap(section =>
        section.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          roomId: room.id,
          roomName: room.name || room.type.replace(/_/g, ' '),
          roomType: room.type,
          sectionId: section.id,
          sectionName: section.name,
          ffeInstanceId: room.ffeInstance?.id,
          categoryName: item.libraryProduct?.category?.name || section.name,
          productName: item.libraryProduct?.name || item.modelNumber,
          brand: item.brand || item.libraryProduct?.brand,
          sku: item.sku || item.libraryProduct?.sku,
          color: item.color || item.libraryProduct?.color,
          finish: item.finish || item.libraryProduct?.finish,
          material: item.material || item.libraryProduct?.material,
          width: item.width || item.libraryProduct?.width,
          height: item.height || item.libraryProduct?.height,
          depth: item.depth || item.libraryProduct?.depth,
          length: item.libraryProduct?.length,
          quantity: item.quantity,
          leadTime: item.leadTime || item.libraryProduct?.leadTime,
          supplierName: item.supplierName || item.libraryProduct?.supplierName,
          supplierLink: item.supplierLink || item.libraryProduct?.supplierLink,
          state: item.state,
          specStatus: item.specStatus,
          visibility: item.visibility,
          images: item.images?.length ? item.images : (item.libraryProduct?.images || []),
          thumbnailUrl: item.libraryProduct?.thumbnailUrl,
          unitCost: item.unitCost ? Number(item.unitCost) : null,
          totalCost: item.totalCost ? Number(item.totalCost) : null,
          tradePrice: item.tradePrice ? Number(item.tradePrice) : null,
          rrp: item.rrp ? Number(item.rrp) : null,
          tradeDiscount: item.tradeDiscount ? Number(item.tradeDiscount) : null
        }))
      ) : []
    )

    // Filter to only visible items that are actual specs (not DRAFT tasks from FFE Workspace)
    // DRAFT = tasks/requirements that need spec selection
    // SELECTED, QUOTING, etc. = actual specified items
    const visibleSpecs = specs.filter(spec => 
      spec.visibility === 'VISIBLE' && spec.specStatus !== 'DRAFT'
    )

    // Calculate stats
    const totalItems = visibleSpecs.length
    const completedItems = visibleSpecs.filter(s => s.specStatus === 'SPECIFIED').length
    
    // Calculate financial totals
    const totalTradePrice = visibleSpecs.reduce((sum, s) => {
      const price = s.tradePrice || 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)
    
    const totalRRP = visibleSpecs.reduce((sum, s) => {
      const price = s.rrp || 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)
    
    const avgTradeDiscount = totalRRP > 0 
      ? ((totalRRP - totalTradePrice) / totalRRP * 100)
      : 0

    return NextResponse.json({
      specs: visibleSpecs,
      stats: {
        totalItems,
        completedItems,
        progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
      },
      financials: {
        totalTradePrice,
        totalRRP,
        avgTradeDiscount: Math.round(avgTradeDiscount * 100) / 100
      }
    })

  } catch (error) {
    console.error('Error fetching project specs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch specs' },
      { status: 500 }
    )
  }
}

