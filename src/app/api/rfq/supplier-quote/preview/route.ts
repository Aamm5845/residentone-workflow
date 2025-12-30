import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/supplier-quote/preview
 *
 * Create a temporary preview link to see what the supplier portal looks like
 * for a specific set of items. This allows testing before sending.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, itemIds, supplierId, shippingAddress } = body

    if (!projectId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Project ID and at least one item ID required' },
        { status: 400 }
      )
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Get project details
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: {
        id: true,
        name: true,
        streetAddress: true,
        city: true,
        province: true,
        postalCode: true,
        client: { select: { name: true, email: true, phone: true } }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get items
    const items = await prisma.roomFFEItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        brand: true,
        sku: true,
        quantity: true,
        unitType: true,
        notes: true
      }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found' }, { status: 400 })
    }

    // Get supplier info if specified
    let supplier = null
    if (supplierId) {
      supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, orgId },
        select: { id: true, name: true, email: true }
      })
    }

    // Check for or create a preview RFQ (reuse if exists for this project)
    let previewRfq = await prisma.rFQ.findFirst({
      where: {
        projectId,
        orgId,
        title: { startsWith: '[PREVIEW]' }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!previewRfq) {
      // Create preview RFQ
      const rfqNumber = `PREVIEW-${Date.now()}`
      previewRfq = await prisma.rFQ.create({
        data: {
          orgId,
          projectId,
          rfqNumber,
          title: `[PREVIEW] Quote Request - ${project.name}`,
          description: 'This is a preview of what the supplier will see.',
          status: 'DRAFT',
          responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdById: userId,
          updatedById: userId,
          lineItems: {
            create: items.map((item, index) => ({
              roomFFEItemId: item.id,
              itemName: item.name,
              itemDescription: item.description || '',
              quantity: item.quantity || 1,
              unitType: item.unitType || 'units',
              order: index,
              notes: item.notes || null
            }))
          }
        }
      })
    } else {
      // Update existing preview RFQ with new items
      await prisma.rFQLineItem.deleteMany({
        where: { rfqId: previewRfq.id }
      })
      await prisma.rFQLineItem.createMany({
        data: items.map((item, index) => ({
          rfqId: previewRfq!.id,
          roomFFEItemId: item.id,
          itemName: item.name,
          itemDescription: item.description || '',
          quantity: item.quantity || 1,
          unitType: item.unitType || 'units',
          order: index,
          notes: item.notes || null
        }))
      })
    }

    // Check for or create a preview SupplierRFQ
    let previewSupplierRfq = await prisma.supplierRFQ.findFirst({
      where: {
        rfqId: previewRfq.id,
        OR: [
          { supplierId: supplier?.id || undefined },
          { vendorName: 'Preview Supplier' }
        ].filter(c => Object.values(c)[0] !== undefined)
      }
    })

    if (!previewSupplierRfq) {
      previewSupplierRfq = await prisma.supplierRFQ.create({
        data: {
          rfqId: previewRfq.id,
          supplierId: supplier?.id || null,
          vendorName: supplier?.name || 'Preview Supplier',
          vendorEmail: supplier?.email || 'preview@example.com',
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          responseStatus: 'PENDING',
          shippingAddress: shippingAddress || null
        }
      })
    } else {
      // Reset and extend token, update shipping address
      previewSupplierRfq = await prisma.supplierRFQ.update({
        where: { id: previewSupplierRfq.id },
        data: {
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          responseStatus: 'PENDING',
          viewedAt: null,
          respondedAt: null,
          shippingAddress: shippingAddress || previewSupplierRfq.shippingAddress
        }
      })
    }

    const baseUrl = getBaseUrl()
    const previewUrl = `${baseUrl}/supplier-portal/${previewSupplierRfq.accessToken}`

    return NextResponse.json({
      success: true,
      previewUrl,
      rfqId: previewRfq.id,
      supplierRfqId: previewSupplierRfq.id,
      expiresAt: previewSupplierRfq.tokenExpiresAt
    })

  } catch (error) {
    console.error('Error creating preview:', error)
    return NextResponse.json(
      { error: 'Failed to create preview' },
      { status: 500 }
    )
  }
}
