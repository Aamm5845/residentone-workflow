import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateComponentsTotal, calculateComponentsRRP } from '@/lib/pricing'

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

    // Fetch items directly - same query pattern as new share links and Financial Tab
    // This ensures consistent item inclusion across all views
    const items = await prisma.roomFFEItem.findMany({
      where: {
        visibility: 'VISIBLE',
        specStatus: { notIn: ['DRAFT', 'NEEDS_SPEC', 'HIDDEN', 'ARCHIVED'] },
        section: {
          instance: {
            room: {
              projectId: projectId
            }
          }
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
        },
        components: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    })

    // Transform specs data
    const specs = items.map(item => {
      const room = item.section?.instance?.room
      const markupPercent = item.markupPercent || 0

      // Use centralized pricing calculation for components with markup
      const componentsTotal = calculateComponentsRRP(item.components || [], markupPercent)

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        roomName: room?.name || room?.type?.replace(/_/g, ' ') || 'Room',
        roomType: room?.type,
        sectionName: item.section?.name || '',
        categoryName: item.section?.name || '',
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




