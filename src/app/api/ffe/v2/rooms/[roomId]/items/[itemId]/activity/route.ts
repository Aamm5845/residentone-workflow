import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ffe/v2/rooms/[roomId]/items/[itemId]/activity
 *
 * Get activity history for an item including:
 * - Quote requests sent
 * - Status changes
 * - Price updates
 * - Client approvals
 * - Order history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId, itemId } = await params

    // Get item to verify it exists and user has access
    const item = await prisma.roomFFEItem.findFirst({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        section: {
          select: {
            instance: {
              select: {
                roomId: true,
                room: {
                  select: {
                    project: {
                      select: { orgId: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const orgId = (session.user as any).orgId
    if (item.section?.instance?.room?.project?.orgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get activities from ItemActivity table
    const activities = await prisma.itemActivity.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Get quote requests for this item
    const quoteRequests = await prisma.itemQuoteRequest.findMany({
      where: { itemId },
      orderBy: { sentAt: 'desc' },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            logo: true
          }
        },
        sentBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Get RFQ line items for this item (to track quote responses)
    const rfqLineItems = await prisma.rFQLineItem.findMany({
      where: { roomFFEItemId: itemId },
      include: {
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            status: true,
            sentAt: true,
            supplierRFQs: {
              include: {
                supplier: {
                  select: { id: true, name: true }
                },
                quotes: {
                  select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    submittedAt: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Combine and format timeline
    const timeline: Array<{
      id: string
      type: string
      title: string
      description?: string
      timestamp: string
      actor?: {
        id?: string
        name?: string
        email?: string
        image?: string
        type: string
      }
      metadata?: any
    }> = []

    // Add activities
    for (const activity of activities) {
      timeline.push({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description || undefined,
        timestamp: activity.createdAt.toISOString(),
        actor: activity.actor ? {
          id: activity.actor.id,
          name: activity.actor.name || undefined,
          email: activity.actor.email,
          image: activity.actor.image || undefined,
          type: activity.actorType
        } : activity.actorName ? {
          name: activity.actorName,
          type: activity.actorType
        } : undefined,
        metadata: activity.metadata as any
      })
    }

    // Add quote requests
    for (const qr of quoteRequests) {
      timeline.push({
        id: `qr-${qr.id}`,
        type: 'QUOTE_REQUESTED',
        title: 'Quote Requested',
        description: `Sent to ${qr.supplier?.name || qr.vendorName || qr.vendorEmail}`,
        timestamp: qr.sentAt.toISOString(),
        actor: qr.sentBy ? {
          id: qr.sentBy.id,
          name: qr.sentBy.name || undefined,
          email: qr.sentBy.email,
          type: 'user'
        } : undefined,
        metadata: {
          supplierId: qr.supplierId,
          supplierName: qr.supplier?.name || qr.vendorName,
          supplierEmail: qr.supplier?.email || qr.vendorEmail,
          status: qr.status,
          rfqId: qr.rfqId
        }
      })
    }

    // Add quote responses from RFQ system
    for (const lineItem of rfqLineItems) {
      if (lineItem.rfq?.supplierRFQs) {
        for (const supplierRfq of lineItem.rfq.supplierRFQs) {
          for (const quote of supplierRfq.quotes || []) {
            if (quote.submittedAt) {
              const supplierName = supplierRfq.supplier?.name || 'Supplier'

              timeline.push({
                id: `quote-${quote.id}`,
                type: 'QUOTE_RECEIVED',
                title: 'Quote Received',
                description: `${supplierName} submitted a quote`,
                timestamp: quote.submittedAt.toISOString(),
                actor: {
                  name: supplierName,
                  type: 'supplier'
                },
                metadata: {
                  quoteId: quote.id,
                  totalAmount: quote.totalAmount,
                  status: quote.status
                }
              })
            }
          }
        }
      }
    }

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Deduplicate by id
    const seen = new Set<string>()
    const uniqueTimeline = timeline.filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })

    return NextResponse.json({
      itemId,
      itemName: item.name,
      activities: uniqueTimeline,
      quoteRequests: quoteRequests.map(qr => ({
        id: qr.id,
        supplierId: qr.supplierId,
        supplierName: qr.supplier?.name || qr.vendorName,
        supplierEmail: qr.supplier?.email || qr.vendorEmail,
        supplierLogo: qr.supplier?.logo,
        status: qr.status,
        sentAt: qr.sentAt,
        respondedAt: qr.respondedAt,
        quoteAmount: qr.quoteAmount,
        sentBy: qr.sentBy
      }))
    })

  } catch (error) {
    console.error('Error getting item activity:', error)
    return NextResponse.json(
      { error: 'Failed to get activity' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ffe/v2/rooms/[roomId]/items/[itemId]/activity
 *
 * Add a new activity entry for an item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId, itemId } = await params
    const body = await request.json()
    const { type, title, description, metadata } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const userName = session.user.name || session.user.email

    const activity = await prisma.itemActivity.create({
      data: {
        itemId,
        type,
        title,
        description,
        actorId: userId,
        actorName: userName,
        actorType: 'user',
        metadata
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({ activity })

  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}
