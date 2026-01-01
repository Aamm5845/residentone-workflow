import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rfq
 * Get all RFQs for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)

    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { orgId }

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    const [rfqs, total] = await Promise.all([
      prisma.rFQ.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          supplierRFQs: {
            select: {
              id: true,
              responseStatus: true,
              viewedAt: true,
              sentAt: true,
              vendorName: true,
              vendorEmail: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              quotes: {
                select: {
                  id: true,
                  status: true,
                  totalAmount: true
                }
              }
            }
          },
          lineItems: {
            select: {
              id: true,
              itemName: true,
              quantity: true
            }
          },
          _count: {
            select: {
              lineItems: true,
              supplierRFQs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.rFQ.count({ where })
    ])

    return NextResponse.json({
      rfqs,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching RFQs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RFQs' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rfq
 * Create a new RFQ
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      projectId,
      title,
      description,
      validUntil,
      responseDeadline,
      groupingType,
      categoryFilter,
      lineItems,
      supplierIds,
      documentIds
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate RFQ number
    const year = new Date().getFullYear()
    const lastRFQ = await prisma.rFQ.findFirst({
      where: {
        orgId,
        rfqNumber: { startsWith: `RFQ-${year}-` }
      },
      orderBy: { rfqNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastRFQ) {
      const match = lastRFQ.rfqNumber.match(/RFQ-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const rfqNumber = `RFQ-${year}-${String(nextNumber).padStart(4, '0')}`

    // Create RFQ with line items
    const rfq = await prisma.rFQ.create({
      data: {
        orgId,
        projectId,
        rfqNumber,
        title,
        description: description || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        responseDeadline: responseDeadline ? new Date(responseDeadline) : null,
        groupingType: groupingType || null,
        categoryFilter: categoryFilter || null,
        createdById: userId,
        updatedById: userId,
        lineItems: lineItems?.length ? {
          create: lineItems.map((item: any, index: number) => ({
            roomFFEItemId: item.roomFFEItemId,
            itemName: item.itemName,
            itemDescription: item.itemDescription || null,
            quantity: item.quantity || 1,
            unitType: item.unitType || 'units',
            specifications: item.specifications || null,
            targetUnitPrice: item.targetUnitPrice || null,
            targetTotalPrice: item.targetTotalPrice || null,
            notes: item.notes || null,
            order: index
          }))
        } : undefined,
        supplierRFQs: supplierIds?.length ? {
          create: supplierIds.map((supplierId: string) => ({
            supplierId
          }))
        } : undefined
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        lineItems: true,
        supplierRFQs: {
          include: {
            supplier: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    // Link any uploaded documents to this RFQ
    if (documentIds?.length) {
      await prisma.rFQDocument.updateMany({
        where: {
          id: { in: documentIds },
          orgId
        },
        data: {
          rfqId: rfq.id
        }
      })
    }

    // Create activity log
    await prisma.rFQActivity.create({
      data: {
        rfqId: rfq.id,
        type: 'CREATED',
        message: `RFQ ${rfqNumber} created`,
        userId
      }
    })

    return NextResponse.json({ rfq })
  } catch (error) {
    console.error('Error creating RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to create RFQ' },
      { status: 500 }
    )
  }
}
