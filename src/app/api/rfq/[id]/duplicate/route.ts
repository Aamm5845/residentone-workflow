import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/[id]/duplicate
 * Duplicate an existing RFQ as a new draft
 */
export async function POST(
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
    const userId = session.user.id

    // Get the original RFQ with line items and suppliers
    const original = await prisma.rFQ.findFirst({
      where: { id, orgId },
      include: {
        lineItems: true,
        supplierRFQs: {
          include: {
            supplier: true
          }
        }
      }
    })

    if (!original) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    // Generate new RFQ number
    const year = new Date().getFullYear()
    const lastRfq = await prisma.rFQ.findFirst({
      where: {
        orgId,
        rfqNumber: {
          startsWith: `RFQ-${year}-`
        }
      },
      orderBy: { rfqNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastRfq) {
      const parts = lastRfq.rfqNumber.split('-')
      const lastNum = parseInt(parts[2], 10)
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1
      }
    }

    const rfqNumber = `RFQ-${year}-${nextNumber.toString().padStart(4, '0')}`

    // Create the duplicate as a draft (without line items first)
    const duplicate = await prisma.rFQ.create({
      data: {
        rfqNumber,
        title: `${original.title} (Copy)`,
        description: original.description,
        projectId: original.projectId,
        orgId,
        createdById: userId,
        updatedById: userId,
        status: 'DRAFT',
        groupingType: original.groupingType,
        categoryFilter: original.categoryFilter,
        validUntil: original.validUntil,
        responseDeadline: original.responseDeadline
      }
    })

    // Copy line items if any
    if (original.lineItems.length > 0) {
      for (const [index, item] of original.lineItems.entries()) {
        await prisma.rFQLineItem.create({
          data: {
            rfqId: duplicate.id,
            roomFFEItemId: item.roomFFEItemId,
            itemName: item.itemName,
            itemDescription: item.itemDescription,
            quantity: item.quantity,
            unitType: item.unitType,
            specifications: item.specifications ?? undefined,
            notes: item.notes,
            order: index
          }
        })
      }
    }

    // Copy suppliers if any
    if (original.supplierRFQs.length > 0) {
      await prisma.supplierRFQ.createMany({
        data: original.supplierRFQs.map(sRfq => ({
          rfqId: duplicate.id,
          supplierId: sRfq.supplierId,
          vendorName: sRfq.vendorName,
          vendorEmail: sRfq.vendorEmail,
          responseStatus: 'PENDING'
        }))
      })
    }

    // Fetch the complete duplicate with relations
    const result = await prisma.rFQ.findUnique({
      where: { id: duplicate.id },
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

    return NextResponse.json({
      success: true,
      rfq: result,
      message: `Created duplicate: ${rfqNumber}`
    })
  } catch (error) {
    console.error('Error duplicating RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate RFQ' },
      { status: 500 }
    )
  }
}
