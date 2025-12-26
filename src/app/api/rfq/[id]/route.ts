import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rfq/[id]
 * Get a specific RFQ with full details
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

    const { id } = await params
    const orgId = (session.user as any).orgId

    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        updatedBy: {
          select: { id: true, name: true }
        },
        sentBy: {
          select: { id: true, name: true }
        },
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
                sku: true,
                supplierName: true,
                images: true,
                section: {
                  select: {
                    id: true,
                    name: true,
                    instance: {
                      select: {
                        room: {
                          select: {
                            id: true,
                            name: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        supplierRFQs: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                contactName: true
              }
            },
            quotes: {
              include: {
                lineItems: true
              },
              orderBy: { version: 'desc' }
            }
          }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    return NextResponse.json({ rfq })
  } catch (error) {
    console.error('Error fetching RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RFQ' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/rfq/[id]
 * Update an RFQ
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify RFQ belongs to org
    const existing = await prisma.rFQ.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    // Can't update if already sent (unless specific fields)
    const allowedFieldsAfterSent = ['internalNotes']
    if (existing.status !== 'DRAFT') {
      const fieldsBeingUpdated = Object.keys(body)
      const hasDisallowedFields = fieldsBeingUpdated.some(
        f => !allowedFieldsAfterSent.includes(f) && f !== 'status'
      )
      if (hasDisallowedFields && body.status !== 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot modify RFQ after it has been sent' },
          { status: 400 }
        )
      }
    }

    const {
      title,
      description,
      validUntil,
      responseDeadline,
      groupingType,
      categoryFilter,
      status
    } = body

    const rfq = await prisma.rFQ.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
        ...(responseDeadline !== undefined && { responseDeadline: responseDeadline ? new Date(responseDeadline) : null }),
        ...(groupingType !== undefined && { groupingType }),
        ...(categoryFilter !== undefined && { categoryFilter }),
        ...(status !== undefined && { status }),
        updatedById: userId
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        lineItems: true,
        supplierRFQs: {
          include: {
            supplier: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    // Log activity
    if (status && status !== existing.status) {
      await prisma.rFQActivity.create({
        data: {
          rfqId: id,
          type: 'STATUS_CHANGED',
          message: `Status changed from ${existing.status} to ${status}`,
          userId
        }
      })
    }

    return NextResponse.json({ rfq })
  } catch (error) {
    console.error('Error updating RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to update RFQ' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rfq/[id]
 * Delete an RFQ (only if in DRAFT status)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId

    const existing = await prisma.rFQ.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft RFQs can be deleted' },
        { status: 400 }
      )
    }

    await prisma.rFQ.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to delete RFQ' },
      { status: 500 }
    )
  }
}
