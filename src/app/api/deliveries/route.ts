import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deliveries
 * Get all deliveries, optionally filtered by order
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const status = searchParams.get('status')

    const where: any = {
      order: {
        orgId
      }
    }

    if (orderId) {
      where.orderId = orderId
    }

    if (status) {
      where.status = status
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ deliveries })
  } catch (error) {
    console.error('Error fetching deliveries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/deliveries
 * Create a new delivery record
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { orderId, scheduledDate, carrier, trackingNumber, notes } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Verify order belongs to org
    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const delivery = await prisma.delivery.create({
      data: {
        orderId,
        status: 'PENDING',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        carrier,
        trackingNumber,
        notes
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    })

    return NextResponse.json(delivery)
  } catch (error) {
    console.error('Error creating delivery:', error)
    return NextResponse.json(
      { error: 'Failed to create delivery' },
      { status: 500 }
    )
  }
}
