import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/[id]
 * Get detailed supplier information with all RFQs, quotes, and orders
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

    // Get user's orgId
    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { id } = await params

    // Get supplier with all related data
    const supplier = await prisma.supplier.findFirst({
      where: {
        id,
        orgId
      },
      include: {
        category: true,
        // Get all RFQs sent to this supplier
        supplierRFQs: {
          include: {
            rfq: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    client: {
                      select: {
                        name: true,
                        company: true
                      }
                    }
                  }
                },
                lineItems: {
                  include: {
                    roomFFEItem: {
                      select: {
                        id: true,
                        name: true,
                        images: true,
                        brand: true,
                        sku: true
                      }
                    }
                  }
                }
              }
            },
            quotes: {
              include: {
                lineItems: true
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          },
          orderBy: {
            sentAt: 'desc'
          }
        },
        // Get all orders from this supplier
        orders: {
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            },
            items: {
              include: {
                roomFFEItem: {
                  select: {
                    id: true,
                    name: true,
                    images: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Calculate statistics
    const totalRFQs = supplier.supplierRFQs.length
    const pendingRFQs = supplier.supplierRFQs.filter(sr => sr.responseStatus === 'PENDING').length
    const quotedRFQs = supplier.supplierRFQs.filter(sr => sr.responseStatus === 'SUBMITTED').length
    const declinedRFQs = supplier.supplierRFQs.filter(sr => sr.responseStatus === 'DECLINED').length

    // Calculate total items requested
    const totalItemsRequested = supplier.supplierRFQs.reduce((sum, sr) => {
      return sum + (sr.rfq?.lineItems?.length || 0)
    }, 0)

    // Calculate total quoted value
    const totalQuotedValue = supplier.supplierRFQs.reduce((sum, sr) => {
      return sum + sr.quotes.reduce((qSum, quote) => {
        return qSum + (quote.totalAmount?.toNumber() || 0)
      }, 0)
    }, 0)

    // Calculate total order value
    const totalOrderValue = supplier.orders.reduce((sum, order) => {
      return sum + (order.totalAmount?.toNumber() || 0)
    }, 0)

    // Get unique projects
    const projectsMap = new Map<string, { id: string; name: string; clientName?: string }>()
    supplier.supplierRFQs.forEach(sr => {
      if (sr.rfq?.project) {
        projectsMap.set(sr.rfq.project.id, {
          id: sr.rfq.project.id,
          name: sr.rfq.project.name,
          clientName: sr.rfq.project.client?.name || sr.rfq.project.client?.company
        })
      }
    })
    supplier.orders.forEach(order => {
      if (order.project) {
        projectsMap.set(order.project.id, {
          id: order.project.id,
          name: order.project.name
        })
      }
    })

    // Get all line items with their status
    const allItems: Array<{
      id: string
      name: string
      images?: string[]
      brand?: string
      sku?: string
      quantity: number
      projectName: string
      rfqNumber: string
      rfqStatus: string
      quotedPrice?: number
      quoteStatus?: string
      orderStatus?: string
    }> = []

    supplier.supplierRFQs.forEach(sr => {
      sr.rfq?.lineItems?.forEach(lineItem => {
        const quote = sr.quotes[0] // Most recent quote
        const quotedLineItem = quote?.lineItems?.find(
          ql => ql.rfqLineItemId === lineItem.id
        )

        allItems.push({
          id: lineItem.id,
          name: lineItem.itemName,
          images: lineItem.roomFFEItem?.images as string[] | undefined,
          brand: lineItem.roomFFEItem?.brand || undefined,
          sku: lineItem.roomFFEItem?.sku || undefined,
          quantity: lineItem.quantity,
          projectName: sr.rfq?.project?.name || 'Unknown',
          rfqNumber: sr.rfq?.rfqNumber || '',
          rfqStatus: sr.responseStatus,
          quotedPrice: quotedLineItem?.unitPrice?.toNumber(),
          quoteStatus: quote?.status
        })
      })
    })

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        website: supplier.website,
        logo: supplier.logo,
        address: supplier.address,
        city: supplier.city,
        province: supplier.province,
        postalCode: supplier.postalCode,
        country: supplier.country,
        notes: supplier.notes,
        currency: supplier.currency,
        category: supplier.category,
        additionalEmails: supplier.additionalEmails,
        hasPortalAccess: supplier.hasPortalAccess,
        portalLastLogin: supplier.portalLastLogin,
        createdAt: supplier.createdAt
      },
      statistics: {
        totalRFQs,
        pendingRFQs,
        quotedRFQs,
        declinedRFQs,
        totalItemsRequested,
        totalQuotedValue,
        totalOrderValue,
        totalOrders: supplier.orders.length,
        projectCount: projectsMap.size
      },
      projects: Array.from(projectsMap.values()),
      rfqs: supplier.supplierRFQs.map(sr => ({
        id: sr.id,
        rfqId: sr.rfq?.id,
        rfqNumber: sr.rfq?.rfqNumber,
        title: sr.rfq?.title,
        projectName: sr.rfq?.project?.name,
        projectId: sr.rfq?.project?.id,
        status: sr.responseStatus,
        sentAt: sr.sentAt,
        viewedAt: sr.viewedAt,
        respondedAt: sr.respondedAt,
        accessToken: sr.accessToken,
        itemCount: sr.rfq?.lineItems?.length || 0,
        quote: sr.quotes[0] ? {
          id: sr.quotes[0].id,
          quoteNumber: sr.quotes[0].quoteNumber,
          status: sr.quotes[0].status,
          totalAmount: sr.quotes[0].totalAmount?.toNumber(),
          submittedAt: sr.quotes[0].submittedAt,
          validUntil: sr.quotes[0].validUntil
        } : null
      })),
      orders: supplier.orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        projectName: order.project?.name,
        projectId: order.project?.id,
        status: order.status,
        totalAmount: order.totalAmount?.toNumber(),
        itemCount: order.items.length,
        createdAt: order.createdAt,
        expectedDeliveryDate: order.expectedDeliveryDate
      })),
      items: allItems
    })

  } catch (error) {
    console.error('Error fetching supplier details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier details' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update supplier information
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { id } = await params
    const body = await request.json()

    // Verify supplier belongs to org
    const existing = await prisma.supplier.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: body.name,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        website: body.website,
        logo: body.logo,
        address: body.address,
        city: body.city,
        province: body.province,
        postalCode: body.postalCode,
        country: body.country,
        notes: body.notes,
        currency: body.currency,
        categoryId: body.categoryId,
        additionalEmails: body.additionalEmails
      }
    })

    // If currency is provided, update all linked spec items to use the supplier's currency
    // Always update to ensure consistency (even if currency appears same, items might be out of sync)
    if (body.currency) {
      const updateResult = await prisma.roomFFEItem.updateMany({
        where: { supplierId: id },
        data: {
          tradePriceCurrency: body.currency,
          rrpCurrency: body.currency
        }
      })
      console.log(`Updated ${updateResult.count} items to currency: ${body.currency}`)
    }

    return NextResponse.json({ success: true, supplier: updated })

  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}
