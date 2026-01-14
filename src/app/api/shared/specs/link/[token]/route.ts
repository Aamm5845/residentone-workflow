import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { calculateComponentsTotal, calculateComponentsRRP } from '@/lib/pricing'

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
              select: { name: true, businessName: true, businessEmail: true }
            },
            client: {
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

    // Fetch items - if itemIds is empty, fetch ALL visible specs from the project (Select All mode)
    const isSelectAll = !shareLink.itemIds || shareLink.itemIds.length === 0

    const items = await prisma.roomFFEItem.findMany({
      where: isSelectAll
        ? {
            // Select All mode - fetch all visible spec items from the project
            // Match the same filtering as the specs API (Financial Tab)
            visibility: 'VISIBLE',
            specStatus: { notIn: ['DRAFT', 'NEEDS_SPEC', 'HIDDEN'] },
            section: {
              instance: {
                room: {
                  projectId: shareLink.projectId
                }
              }
            }
          }
        : {
            // Specific items mode
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
        },
        // Include components for price calculation
        components: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    })

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
        description: shareLink.showNotes !== false ? item.description : null, // Respect showNotes setting
        notes: shareLink.showNotes !== false ? item.notes : null, // Item notes
        docCode: item.docCode || null, // Document code
        roomName: room?.name || room?.type?.replace(/_/g, ' ') || 'Room',
        roomType: room?.type,
        sectionName: item.section?.name || '',
        categoryName: item.section?.name || '',
        productName: item.modelNumber,
        brand: shareLink.showBrand ? item.brand : null,
        sku: item.sku,
        modelNumber: item.modelNumber,
        supplierName: shareLink.showSupplier ? item.supplierName : null,
        supplierLink: item.supplierLink, // Always provide product link
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
        tradePriceCurrency: item.tradePriceCurrency || 'CAD',
        rrpCurrency: item.rrpCurrency || 'CAD',
        // Spec sheets / attachments
        attachments: shareLink.showSpecSheets ? (item.attachments || null) : null,
        // Approval fields - always include so UI can show status
        clientApproved: item.clientApproved || false,
        clientApprovedAt: item.clientApprovedAt?.toISOString() || null,
        // Components - always include for name/qty, add pricing only if enabled
        // Apply markup to component prices for RRP display (using centralized pricing)
        markupPercent: shareLink.showPricing ? (item.markupPercent || 0) : 0,
        components: (item.components || []).map(c => {
          const basePrice = c.price ? Number(c.price) : null
          const markupPercent = item.markupPercent || 0
          // Apply markup to component price for client-facing RRP
          const priceWithMarkup = basePrice !== null ? basePrice * (1 + markupPercent / 100) : null
          return {
            id: c.id,
            name: c.name,
            modelNumber: c.modelNumber,
            image: c.image,
            // Only include price if pricing is enabled
            price: shareLink.showPricing ? priceWithMarkup : null,
            quantity: c.quantity || 1
          }
        }),
        // Use centralized pricing calculation for components with markup
        componentsTotal: shareLink.showPricing
          ? calculateComponentsRRP(item.components || [], item.markupPercent || 0)
          : 0
      }
    })

    return NextResponse.json({
      success: true,
      linkName: shareLink.name,
      projectName: shareLink.project.name,
      clientName: shareLink.project.client?.name || '',
      orgName: shareLink.project.organization?.businessName || shareLink.project.organization?.name || '',
      orgEmail: shareLink.project.organization?.businessEmail || '',
      specs,
      shareSettings: {
        showSupplier: shareLink.showSupplier,
        showBrand: shareLink.showBrand,
        showPricing: shareLink.showPricing,
        showDetails: shareLink.showDetails,
        showSpecSheets: shareLink.showSpecSheets || false,
        showNotes: shareLink.showNotes !== false, // Default to true
        allowApproval: shareLink.allowApproval || false
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
