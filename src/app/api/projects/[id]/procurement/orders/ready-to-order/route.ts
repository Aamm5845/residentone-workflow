// Get items that are paid but not yet ordered (ready to order)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface ItemComponent {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
}

interface ReadyToOrderItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  categoryName: string | null
  quantity: number
  imageUrl: string | null
  specStatus: string
  paymentStatus: string
  paidAt: Date | null
  paidAmount: number | null
  // Trade price (default price when no quote)
  tradePrice: number | null
  tradePriceCurrency: string | null
  // Supplier quote info (if exists)
  hasSupplierQuote: boolean
  supplierQuote: {
    id: string
    supplierId: string | null
    supplierName: string
    supplierEmail: string | null
    unitPrice: number
    totalPrice: number
    leadTimeWeeks: number | null
    isAccepted: boolean
    // Additional quote details
    shippingCost: number | null
    currency: string
  } | null
  // Client invoice info
  clientInvoice: {
    id: string
    quoteNumber: string
    title: string | null
    paidAt: Date | null
    clientUnitPrice: number
    clientTotalPrice: number
  } | null
  // Components (sub-items like transformers)
  components: ItemComponent[]
}

interface SupplierGroup {
  supplierId: string | null
  supplierName: string
  supplierEmail: string | null
  items: ReadyToOrderItem[]
  totalCost: number
  itemCount: number
}

/**
 * GET /api/projects/[id]/procurement/orders/ready-to-order
 *
 * Returns all items that are:
 * - Status = CLIENT_PAID (paid by client)
 * - Not yet ordered (no OrderItem exists)
 *
 * Groups items by:
 * - Items with supplier quotes (grouped by supplier)
 * - Items without supplier quotes (need manual order)
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

    const orgId = (session.user as any).orgId
    const { id: projectId } = await params

    // Check for supplier filter
    const { searchParams } = new URL(request.url)
    const filterSupplierId = searchParams.get('supplierId')

    // Verify project access and get address info
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      include: {
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all sections for this project first
    const projectSections = await prisma.roomFFESection.findMany({
      where: {
        instance: {
          room: {
            projectId,
            project: { orgId }
          }
        }
      },
      select: { id: true }
    })

    const sectionIds = projectSections.map(s => s.id)

    if (sectionIds.length === 0) {
      // Build default shipping address from project
      const addrParts = [
        project.streetAddress,
        project.city,
        project.province,
        project.postalCode
      ].filter(Boolean)
      const defaultAddr = addrParts.length > 0
        ? addrParts.join(', ')
        : project.address || ''

      return NextResponse.json({
        project: {
          id: project.id,
          name: project.name,
          address: project.address,
          streetAddress: project.streetAddress,
          city: project.city,
          province: project.province,
          postalCode: project.postalCode,
          defaultShippingAddress: defaultAddr,
          client: project.client ? {
            name: project.client.name,
            email: project.client.email,
            phone: project.client.phone
          } : null
        },
        summary: {
          totalItems: 0,
          itemsWithQuotes: 0,
          itemsWithoutQuotes: 0,
          supplierCount: 0,
          totalCostWithQuotes: 0,
          estimatedCostWithoutQuotes: 0
        },
        supplierGroups: [],
        itemsWithoutQuotes: []
      })
    }

    // Get all items that are paid but not ordered
    const paidItems = await prisma.roomFFEItem.findMany({
      where: {
        sectionId: { in: sectionIds },
        specStatus: 'CLIENT_PAID',
        // Exclude items that already have orders
        orderItems: {
          none: {}
        }
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: true
              }
            }
          }
        },
        // Get the item's supplier (from spec)
        supplier: {
          select: { id: true, name: true, email: true }
        },
        // Get accepted quote or any recent quote
        acceptedQuoteLineItem: {
          include: {
            supplierQuote: {
              include: {
                supplierRFQ: {
                  include: {
                    supplier: {
                      select: { id: true, name: true, email: true }
                    }
                  }
                }
              }
            }
          }
        },
        // Get all quotes for comparison
        allQuoteLineItems: {
          where: { isLatestVersion: true },
          include: {
            supplierQuote: {
              include: {
                supplierRFQ: {
                  include: {
                    supplier: {
                      select: { id: true, name: true, email: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        // Get the client invoice this item was on
        clientQuoteLineItems: {
          where: {
            clientQuote: {
              status: { in: ['APPROVED', 'PAID'] }
            }
          },
          include: {
            clientQuote: {
              select: {
                id: true,
                quoteNumber: true,
                title: true,
                status: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        // Get item components (sub-items like transformers, brackets, etc.)
        components: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { paidAt: 'asc' }, // Oldest paid first
        { name: 'asc' }
      ]
    })

    // Transform and group ALL items by the item's supplier (from spec)
    const supplierGroups: Record<string, SupplierGroup> = {}

    for (const item of paidItems) {
      // Get the item's supplier from the spec (this is the primary grouping)
      const supplierId = item.supplierId || item.supplier?.id || 'unknown'
      const supplierName = item.supplier?.name || item.supplierName || 'Unknown Supplier'
      const supplierEmail = item.supplier?.email || null

      // Get supplier quote info (optional - for additional details)
      const acceptedQuote = item.acceptedQuoteLineItem
      const latestQuote = item.allQuoteLineItems?.[0]
      const supplierQuoteLine = acceptedQuote || latestQuote

      // Get client invoice info
      const clientInvoiceLine = item.clientQuoteLineItems?.[0]

      const readyItem: ReadyToOrderItem = {
        id: item.id,
        name: item.name,
        description: item.description,
        roomName: item.section?.instance?.room?.name || null,
        categoryName: item.section?.name || null,
        quantity: item.quantity || 1,
        imageUrl: item.images?.[0] || null,
        specStatus: item.specStatus,
        paymentStatus: item.paymentStatus || 'FULLY_PAID',
        paidAt: item.paidAt,
        paidAmount: item.paidAmount ? Number(item.paidAmount) : null,
        tradePrice: item.tradePrice ? Number(item.tradePrice) : null,
        tradePriceCurrency: item.tradePriceCurrency || 'CAD',
        hasSupplierQuote: !!supplierQuoteLine,
        supplierQuote: supplierQuoteLine ? {
          id: supplierQuoteLine.id,
          supplierId: supplierQuoteLine.supplierQuote?.supplierRFQ?.supplier?.id || null,
          supplierName: supplierQuoteLine.supplierQuote?.supplierRFQ?.supplier?.name ||
                        supplierQuoteLine.supplierQuote?.supplierRFQ?.vendorName ||
                        'Unknown Supplier',
          supplierEmail: supplierQuoteLine.supplierQuote?.supplierRFQ?.supplier?.email ||
                         supplierQuoteLine.supplierQuote?.supplierRFQ?.vendorEmail || null,
          unitPrice: Number(supplierQuoteLine.unitPrice),
          totalPrice: Number(supplierQuoteLine.totalPrice),
          leadTimeWeeks: supplierQuoteLine.leadTimeWeeks,
          isAccepted: supplierQuoteLine.isAccepted || !!acceptedQuote,
          shippingCost: supplierQuoteLine.supplierQuote?.shippingCost
            ? Number(supplierQuoteLine.supplierQuote.shippingCost)
            : null,
          currency: supplierQuoteLine.currency || item.tradePriceCurrency || 'CAD'
        } : null,
        clientInvoice: clientInvoiceLine ? {
          id: clientInvoiceLine.clientQuote.id,
          quoteNumber: clientInvoiceLine.clientQuote.quoteNumber,
          title: clientInvoiceLine.clientQuote.title,
          paidAt: item.paidAt,
          clientUnitPrice: Number(clientInvoiceLine.clientUnitPrice),
          clientTotalPrice: Number(clientInvoiceLine.clientTotalPrice)
        } : null,
        components: (item.components || []).map(c => ({
          id: c.id,
          name: c.name,
          modelNumber: c.modelNumber,
          price: c.price ? Number(c.price) : null,
          quantity: c.quantity || 1
        }))
      }

      // Group by item's supplier
      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = {
          supplierId: supplierId === 'unknown' ? null : supplierId,
          supplierName,
          supplierEmail,
          items: [],
          totalCost: 0,
          itemCount: 0
        }
      }

      supplierGroups[supplierId].items.push(readyItem)
      // Use quote price if available, otherwise trade price
      const itemPrice = supplierQuoteLine
        ? Number(supplierQuoteLine.totalPrice)
        : (item.tradePrice ? Number(item.tradePrice) * (item.quantity || 1) : 0)
      const componentsCost = readyItem.components.reduce((sum, c) => sum + ((c.price || 0) * (c.quantity || 1)), 0)
      supplierGroups[supplierId].totalCost += itemPrice + componentsCost
      supplierGroups[supplierId].itemCount += 1
    }

    // Calculate totals
    const totalCost = Object.values(supplierGroups).reduce((sum, g) => sum + g.totalCost, 0)

    // Build default shipping address from project
    const addressParts = [
      project.streetAddress,
      project.city,
      project.province,
      project.postalCode
    ].filter(Boolean)
    const defaultShippingAddress = addressParts.length > 0
      ? addressParts.join(', ')
      : project.address || ''

    // Filter by supplier if requested
    let filteredSupplierGroups = Object.values(supplierGroups).sort((a, b) =>
      b.totalCost - a.totalCost
    )

    if (filterSupplierId) {
      filteredSupplierGroups = filteredSupplierGroups.filter(
        g => g.supplierId === filterSupplierId
      )
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        address: project.address,
        streetAddress: project.streetAddress,
        city: project.city,
        province: project.province,
        postalCode: project.postalCode,
        defaultShippingAddress,
        client: project.client ? {
          name: project.client.name,
          email: project.client.email,
          phone: project.client.phone
        } : null
      },
      summary: {
        totalItems: paidItems.length,
        supplierCount: Object.keys(supplierGroups).length,
        totalCost
      },
      // All items grouped by their supplier (from spec)
      supplierGroups: filteredSupplierGroups,
      // Legacy - kept for compatibility but should be empty
      itemsWithoutQuotes: []
    })
  } catch (error) {
    console.error('Error fetching ready to order items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ready to order items' },
      { status: 500 }
    )
  }
}
