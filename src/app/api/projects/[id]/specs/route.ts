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
                  orderBy: { order: 'asc' },
                  include: {
                    libraryProduct: {
                      include: {
                        category: true
                      }
                    },
                    // Include the FFE requirement this spec is linked to (legacy one-to-one)
                    ffeRequirement: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        customFields: true  // Include grouping info
                      }
                    },
                    // Include all linked FFE items (new many-to-many)
                    specLinks: {
                      include: {
                        ffeRequirement: {
                          select: {
                            id: true,
                            name: true,
                            description: true,
                            notes: true,
                            customFields: true  // Include grouping info
                          }
                        }
                      },
                      orderBy: { createdAt: 'asc' }
                    },
                    // Include quote requests to show resend status
                    quoteRequests: {
                      select: {
                        id: true,
                        status: true,
                        sentAt: true,
                        respondedAt: true,
                        supplier: {
                          select: { id: true, name: true }
                        },
                        vendorName: true
                      },
                      orderBy: { sentAt: 'desc' }
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
          docCode: item.docCode,
          modelNumber: item.modelNumber || item.libraryProduct?.modelNumber,
          color: item.color || item.libraryProduct?.color,
          finish: item.finish || item.libraryProduct?.finish,
          material: item.material || item.libraryProduct?.material,
          width: item.width || item.libraryProduct?.width,
          height: item.height || item.libraryProduct?.height,
          depth: item.depth || item.libraryProduct?.depth,
          length: item.length || item.libraryProduct?.length,
          quantity: item.quantity,
          unitType: item.unitType || 'units',
          customFields: item.customFields,
          leadTime: item.leadTime || item.libraryProduct?.leadTime,
          supplierName: item.supplierName || item.libraryProduct?.supplierName,
          supplierLink: item.supplierLink || item.libraryProduct?.supplierLink,
          supplierId: item.supplierId,
          state: item.state,
          specStatus: item.specStatus,
          visibility: item.visibility,
          images: item.images?.length ? item.images : (item.libraryProduct?.images || []),
          thumbnailUrl: item.images?.[0] || item.libraryProduct?.thumbnailUrl || null,
          unitCost: item.unitCost ? Number(item.unitCost) : null,
          totalCost: item.totalCost ? Number(item.totalCost) : null,
          tradePrice: item.tradePrice ? Number(item.tradePrice) : null,
          tradePriceCurrency: item.tradePriceCurrency || 'CAD',
          rrp: item.rrp ? Number(item.rrp) : null,
          rrpCurrency: item.rrpCurrency || 'CAD',
          tradeDiscount: item.tradeDiscount ? Number(item.tradeDiscount) : null,
          markupPercent: item.markupPercent ? Number(item.markupPercent) : null,
          libraryProductId: item.libraryProductId,
          // FFE Linking info (legacy one-to-one)
          isSpecItem: item.isSpecItem,
          ffeRequirementId: item.ffeRequirementId,
          ffeRequirementName: item.ffeRequirement?.name || null,
          isOption: item.isOption,
          optionNumber: item.optionNumber,
          clientApproved: item.clientApproved || false,
          clientApprovedAt: item.clientApprovedAt?.toISOString() || null,
          clientApprovedVia: item.clientApprovedVia || null,
          // NEW: Multiple linked FFE items (many-to-many)
          notes: item.notes,
          linkedFfeItems: (item.specLinks || []).map(link => {
            const ffeCustomFields = link.ffeRequirement?.customFields as any
            return {
              linkId: link.id,
              ffeItemId: link.ffeRequirementId,
              ffeItemName: link.ffeRequirement?.name || 'Unknown',
              roomId: link.roomId,
              roomName: link.roomName || 'Unknown Room',
              sectionName: link.sectionName || 'Unknown Section',
              // Include FFE requirement's grouping info
              isGroupedItem: ffeCustomFields?.isLinkedItem || ffeCustomFields?.isGroupedItem || false,
              parentName: ffeCustomFields?.parentName || null,
              hasChildren: ffeCustomFields?.hasChildren || false,
              linkedItems: ffeCustomFields?.linkedItems || []
            }
          }),
          linkedFfeCount: (item.specLinks || []).length,
          // Expose FFE grouping info from legacy one-to-one link
          ffeGroupingInfo: item.ffeRequirement ? {
            isGroupedItem: (item.ffeRequirement.customFields as any)?.isLinkedItem || (item.ffeRequirement.customFields as any)?.isGroupedItem || false,
            parentName: (item.ffeRequirement.customFields as any)?.parentName || null,
            hasChildren: (item.ffeRequirement.customFields as any)?.hasChildren || false,
            linkedItems: (item.ffeRequirement.customFields as any)?.linkedItems || []
          } : null,
          // Quote request status for 3-dot menu
          hasQuoteSent: (item.quoteRequests || []).length > 0,
          lastQuoteRequest: item.quoteRequests?.[0] ? {
            id: item.quoteRequests[0].id,
            status: item.quoteRequests[0].status,
            sentAt: item.quoteRequests[0].sentAt,
            supplierName: item.quoteRequests[0].supplier?.name || item.quoteRequests[0].vendorName
          } : null
        }))
      ) : []
    )

    // Filter to only show ACTUAL SPECS (not tasks from FFE Workspace)
    // Task items have specStatus: 'DRAFT' or 'NEEDS_SPEC' - these are FFE Workspace tasks
    // Only show items that have been explicitly spec'd (SELECTED, QUOTING, APPROVED, etc.)
    const visibleSpecs = specs.filter(spec => {
      // Must be visible
      if (spec.visibility !== 'VISIBLE') return false
      
      // FFE Workspace task statuses - these should NOT appear in All Spec
      const taskStatuses = ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
      if (!spec.specStatus || taskStatuses.includes(spec.specStatus)) return false
      
      return true
    })

    // Calculate stats
    const totalItems = visibleSpecs.length
    const completedItems = visibleSpecs.filter(s => s.specStatus === 'CLOSED').length
    const approvedItems = visibleSpecs.filter(s => s.clientApproved).length
    const unapprovedItems = totalItems - approvedItems
    
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

    // Build available rooms list for adding new specs
    const availableRooms = rooms
      .filter(room => room.ffeInstance && room.ffeInstance.sections.length > 0)
      .map(room => ({
        id: room.id,
        name: room.name || room.type.replace(/_/g, ' '),
        sections: room.ffeInstance!.sections.map(section => ({
          id: section.id,
          name: section.name
        }))
      }))

    return NextResponse.json({
      specs: visibleSpecs,
      stats: {
        totalItems,
        completedItems,
        approvedItems,
        unapprovedItems,
        progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
      },
      financials: {
        totalTradePrice,
        totalRRP,
        avgTradeDiscount: Math.round(avgTradeDiscount * 100) / 100
      },
      availableRooms
    })

  } catch (error) {
    console.error('Error fetching project specs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch specs' },
      { status: 500 }
    )
  }
}

