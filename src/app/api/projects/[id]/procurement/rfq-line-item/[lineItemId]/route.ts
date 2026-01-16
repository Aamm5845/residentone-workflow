import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch RFQ line item details including room info for component addition
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId: string | null = session.user.orgId || null
    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { id: projectId, lineItemId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch RFQ line item with room FFE item details
    const rfqLineItem = await prisma.rFQLineItem.findFirst({
      where: {
        id: lineItemId,
        rfq: { projectId }
      },
      include: {
        roomFFEItem: {
          include: {
            section: {
              include: {
                instance: {
                  select: {
                    roomId: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!rfqLineItem) {
      return NextResponse.json({ error: 'RFQ line item not found' }, { status: 404 })
    }

    // Extract roomId from the nested structure
    const roomId = rfqLineItem.roomFFEItem?.section?.instance?.roomId || null
    const roomFFEItemId = rfqLineItem.roomFFEItemId || null

    return NextResponse.json({
      id: rfqLineItem.id,
      itemName: rfqLineItem.itemName,
      quantity: rfqLineItem.quantity,
      roomFFEItemId,
      roomId
    })
  } catch (error) {
    console.error('Error fetching RFQ line item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RFQ line item' },
      { status: 500 }
    )
  }
}
