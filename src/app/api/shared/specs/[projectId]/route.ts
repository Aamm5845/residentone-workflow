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
                        length: true,
                        height: true,
                        depth: true,
                        tradePrice: true,
                        rrp: true,
                        rrpCurrency: true,
                        markupPercent: true,
                        updatedAt: true,
                        createdAt: true,
                        // Include components for price calculation
                        components: {
                          orderBy: { order: 'asc' }
                        }
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
        section.items.map(item => {
          const markupPercent = item.markupPercent || 0
          // Calculate components total with markup applied (matching Financial Tab)
          const rawComponentsTotal = (item.components || []).reduce((sum, c) => {
            const price = c.price ? Number(c.price) : 0
            const qty = c.quantity || 1
            return sum + (price * qty)
          }, 0)
          const componentsTotal = rawComponentsTotal * (1 + markupPercent / 100)

          return {
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
            length: item.length,
            height: item.height,
            depth: item.depth,
            updatedAt: item.updatedAt,
            tradePrice: shareSettings.showPricing ? item.tradePrice : null,
            rrp: shareSettings.showPricing ? item.rrp : null,
            rrpCurrency: item.rrpCurrency || 'CAD',
            // Components with markup applied for RRP display
            components: shareSettings.showPricing ? (item.components || []).map(c => {
              const basePrice = c.price ? Number(c.price) : null
              const priceWithMarkup = basePrice !== null ? basePrice * (1 + markupPercent / 100) : null
              return {
                id: c.id,
                name: c.name,
                modelNumber: c.modelNumber,
                price: priceWithMarkup,
                quantity: c.quantity || 1
              }
            }) : [],
            componentsTotal: shareSettings.showPricing ? componentsTotal : 0
          }
        })
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

    // Calculate last updated from all items
    const lastUpdated = specs.length > 0
      ? specs.reduce((latest, item) => {
          const itemDate = item.updatedAt
          if (!itemDate) return latest
          return !latest || itemDate > latest ? itemDate : latest
        }, null as Date | null)
      : null

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
      },
      lastUpdated: lastUpdated?.toISOString() || null
    })

  } catch (error) {
    console.error('Error fetching shared specs:', error)
    return NextResponse.json(
      { error: 'Failed to load specifications' },
      { status: 500 }
    )
  }
}




