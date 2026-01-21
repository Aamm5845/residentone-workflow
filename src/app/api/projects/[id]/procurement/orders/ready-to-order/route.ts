// Get items that are paid but not yet ordered (ready to order)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all items that are paid but not ordered
    const paidItems = await prisma.roomFFEItem.findMany({
      where: {
        section: {
          instance: {
            room: {
              projectId,
              project: { orgId }
            }
          }
        },
        specStatus: 'CLIENT_PAID',
        // Exclude items that already have orders
        orderItems: {
          none: {}
        }
      },
      include: {
        section: {
          select: {
            name: true,
            instance: {
              select: {
                room: {
                  select: { name: true }
                }
              }
            }
          }
        },
        // Get accepted quote or any recent quote
        acceptedQuoteLineItem: {
          include: {
            supplierQuote: {
              include: {
                supplier: {
                  select: { id: true, name: true, email: true }
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
                supplier: {
                  select: { id: true, name: true, email: true }
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
              },

            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        components: {
          select: { id: true }
        }
      },
      orderBy: [
        { paidAt: 'asc' }, // Oldest paid first
        { name: 'asc' }
      ]
    })

    // Transform and group items
    const itemsWithQuotes: ReadyToOrderItem[] = []
    const itemsWithoutQuotes: ReadyToOrderItem[] = []

    for (const item of paidItems) {
      // Get supplier quote info
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
        categoryName: item.section?.name || null, // Section name as category
        quantity: item.quantity || 1,
        imageUrl: item.imageUrl,
        specStatus: item.specStatus,
        paymentStatus: item.paymentStatus || 'FULLY_PAID',
        paidAt: item.paidAt,
        paidAmount: item.paidAmount ? Number(item.paidAmount) : null,
        hasSupplierQuote: !!supplierQuoteLine,
        supplierQuote: supplierQuoteLine ? {
          id: supplierQuoteLine.id,
          supplierId: supplierQuoteLine.supplierQuote?.supplier?.id || null,
          supplierName: supplierQuoteLine.supplierQuote?.supplier?.name ||
                        supplierQuoteLine.supplierQuote?.vendorName ||
                        'Unknown Supplier',
          supplierEmail: supplierQuoteLine.supplierQuote?.supplier?.email ||
                         supplierQuoteLine.supplierQuote?.vendorEmail || null,
          unitPrice: Number(supplierQuoteLine.unitPrice),
          totalPrice: Number(supplierQuoteLine.totalPrice),
          leadTimeWeeks: supplierQuoteLine.leadTimeWeeks,
          isAccepted: supplierQuoteLine.isAccepted || !!acceptedQuote
        } : null,
        clientInvoice: clientInvoiceLine ? {
          id: clientInvoiceLine.clientQuote.id,
          quoteNumber: clientInvoiceLine.clientQuote.quoteNumber,
          title: clientInvoiceLine.clientQuote.title,
          paidAt: item.paidAt,
          clientUnitPrice: Number(clientInvoiceLine.clientUnitPrice),
          clientTotalPrice: Number(clientInvoiceLine.clientTotalPrice)
        } : null
      }

      if (supplierQuoteLine) {
        itemsWithQuotes.push(readyItem)
      } else {
        itemsWithoutQuotes.push(readyItem)
      }
    }

    // Group items with quotes by supplier
    const supplierGroups: Record<string, SupplierGroup> = {}

    for (const item of itemsWithQuotes) {
      const supplierId = item.supplierQuote?.supplierId || 'unknown'
      const supplierName = item.supplierQuote?.supplierName || 'Unknown Supplier'
      const supplierEmail = item.supplierQuote?.supplierEmail || null

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

      supplierGroups[supplierId].items.push(item)
      supplierGroups[supplierId].totalCost += item.supplierQuote?.totalPrice || 0
      supplierGroups[supplierId].itemCount++
    }

    // Calculate totals
    const totalWithQuotes = itemsWithQuotes.reduce(
      (sum, item) => sum + (item.supplierQuote?.totalPrice || 0),
      0
    )
    const totalWithoutQuotes = itemsWithoutQuotes.reduce(
      (sum, item) => sum + (item.paidAmount || 0),
      0
    )

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name
      },
      summary: {
        totalItems: paidItems.length,
        itemsWithQuotes: itemsWithQuotes.length,
        itemsWithoutQuotes: itemsWithoutQuotes.length,
        supplierCount: Object.keys(supplierGroups).length,
        totalCostWithQuotes: totalWithQuotes,
        estimatedCostWithoutQuotes: totalWithoutQuotes
      },
      // Items grouped by supplier (ready for PO creation)
      supplierGroups: Object.values(supplierGroups).sort((a, b) =>
        b.totalCost - a.totalCost
      ),
      // Items without quotes (need manual ordering)
      itemsWithoutQuotes: itemsWithoutQuotes.sort((a, b) =>
        (a.paidAt?.getTime() || 0) - (b.paidAt?.getTime() || 0)
      )
    })
  } catch (error) {
    console.error('Error fetching ready to order items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ready to order items' },
      { status: 500 }
    )
  }
}
