import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBaseUrl } from '@/lib/get-base-url'
import { generateSupplierQuoteEmailTemplate } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/supplier-quote/preview-email
 *
 * Creates a preview of the email that will be sent to suppliers,
 * with a real working portal link for testing.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, itemIds, supplierId, shippingAddress, message, includeSpecSheet = true, includeNotes = true } = body

    if (!projectId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Project ID and at least one item ID required' },
        { status: 400 }
      )
    }

    // Get orgId from session or fallback to database lookup
    let orgId = (session.user as any).orgId
    let userId = session.user.id

    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      orgId = user?.orgId
      userId = user?.id || userId
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

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

    // Get items with all details needed for email
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
        notes: true,
        images: true,
        color: true,
        finish: true,
        material: true,
        documents: {
          where: { visibleToSupplier: true },
          select: { id: true }
        }
      }
    })

    // Check if any items have documents or notes
    const hasDocuments = items.some(item => item.documents && item.documents.length > 0)
    const hasNotes = items.some(item => item.notes && item.notes.trim().length > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found' }, { status: 400 })
    }

    // Get supplier info if specified
    let supplier = null
    if (supplierId) {
      supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, orgId },
        select: { id: true, name: true, email: true, contactName: true }
      })
    }

    // Create or reuse a preview RFQ
    let previewRfq = await prisma.rFQ.findFirst({
      where: {
        projectId,
        orgId,
        title: { startsWith: '[PREVIEW]' }
      },
      orderBy: { createdAt: 'desc' }
    })

    const rfqNumber = previewRfq?.rfqNumber || `PREVIEW-${Date.now()}`

    if (!previewRfq) {
      previewRfq = await prisma.rFQ.create({
        data: {
          orgId,
          projectId,
          rfqNumber,
          title: `[PREVIEW] Quote Request - ${project.name}`,
          description: message || 'This is a preview of what the supplier will see.',
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

    // Create or reuse preview SupplierRFQ
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
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          responseStatus: 'PENDING',
          shippingAddress: shippingAddress || null,
          includeSpecSheet: includeSpecSheet,
          includeNotes: includeNotes
        }
      })
    } else {
      previewSupplierRfq = await prisma.supplierRFQ.update({
        where: { id: previewSupplierRfq.id },
        data: {
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          responseStatus: 'PENDING',
          viewedAt: null,
          respondedAt: null,
          shippingAddress: shippingAddress || previewSupplierRfq.shippingAddress,
          includeSpecSheet: includeSpecSheet,
          includeNotes: includeNotes
        }
      })
    }

    const baseUrl = getBaseUrl()
    const portalUrl = `${baseUrl}/supplier-portal/${previewSupplierRfq.accessToken}`

    // Build project address string
    const projectAddress = project.streetAddress
      ? `${project.streetAddress}, ${project.city}, ${project.province} ${project.postalCode}`
      : null

    // Generate the email HTML using shared template
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const supplierData = supplier || { name: 'Preview Supplier', contactName: 'Supplier Contact' }
    const emailHtml = generateSupplierQuoteEmailTemplate({
      rfqNumber,
      projectName: project.name,
      projectAddress,
      clientName: project.client?.name || 'Client',
      supplierName: supplierData.contactName || supplierData.name,
      items,
      portalUrl,
      message,
      deadline,
      includeSpecSheet: includeSpecSheet && hasDocuments,
      includeNotes: includeNotes && hasNotes,
      isPreview: true
    })

    return NextResponse.json({
      success: true,
      emailHtml,
      portalUrl,
      rfqNumber
    })

  } catch (error) {
    console.error('Error creating email preview:', error)
    return NextResponse.json(
      { error: 'Failed to create email preview' },
      { status: 500 }
    )
  }
}
