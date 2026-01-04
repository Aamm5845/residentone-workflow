import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { generatePurchaseOrderEmailTemplate, PurchaseOrderEmailData } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/[id]/send
 * Send Purchase Order email to supplier
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
    const body = await request.json()
    const {
      supplierEmail: overrideEmail,
      notes: additionalNotes,
      shippingAddress: overrideShippingAddress,
      expectedDelivery,
      paymentTerms
    } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Fetch order with full details
    const order = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactName: true,
            phone: true,
            address: true
          }
        },
        items: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
                sku: true,
                color: true,
                finish: true,
                images: true,
                notes: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Determine supplier email
    const supplierEmail = overrideEmail || order.supplier?.email || order.vendorEmail
    if (!supplierEmail) {
      return NextResponse.json(
        { error: 'Supplier email is required. Please provide a supplier email address.' },
        { status: 400 }
      )
    }

    // Get organization settings for company branding
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        logo: true,
        phone: true,
        email: true,
        address: true
      }
    })

    // Build email data
    const emailData: PurchaseOrderEmailData = {
      poNumber: order.orderNumber,
      supplierName: order.supplier?.name || order.vendorName || 'Supplier',
      supplierContactName: order.supplier?.contactName || undefined,
      projectName: order.project.name,
      projectAddress: order.project.address,
      companyName: organization?.name || 'Meisner Interiors',
      companyLogo: organization?.logo || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://residentone-workflow.vercel.app'}/meisnerinteriorlogo.png`,
      companyPhone: organization?.phone || undefined,
      companyEmail: organization?.email || 'projects@meisnerinteriors.com',
      companyAddress: organization?.address || undefined,
      items: order.items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unitType,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString()),
        sku: item.roomFFEItem?.sku || null,
        brand: item.roomFFEItem?.brand || null,
        color: item.roomFFEItem?.color || null,
        finish: item.roomFFEItem?.finish || null,
        notes: item.notes || item.roomFFEItem?.notes || null,
        images: item.roomFFEItem?.images as string[] || null
      })),
      subtotal: parseFloat(order.subtotal?.toString() || '0'),
      taxAmount: order.taxAmount ? parseFloat(order.taxAmount.toString()) : undefined,
      shippingCost: order.shippingCost ? parseFloat(order.shippingCost.toString()) : undefined,
      totalAmount: parseFloat(order.totalAmount?.toString() || '0'),
      currency: order.currency,
      shippingAddress: overrideShippingAddress || order.shippingAddress,
      shippingMethod: order.shippingMethod,
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : (order.expectedDelivery || null),
      notes: additionalNotes || order.notes,
      paymentTerms: paymentTerms || 'Net 30',
      orderDate: order.createdAt
    }

    // Generate email
    const { subject, html } = generatePurchaseOrderEmailTemplate(emailData)

    // Send email
    const emailResult = await sendEmail({
      to: supplierEmail,
      subject,
      html
    })

    // Update order status and timestamps
    await prisma.order.update({
      where: { id },
      data: {
        status: 'ORDERED',
        orderedAt: new Date(),
        notes: additionalNotes || order.notes,
        shippingAddress: overrideShippingAddress || order.shippingAddress,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : order.expectedDelivery,
        updatedById: userId
      }
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: id,
        type: 'PO_SENT',
        message: `Purchase order sent to ${order.supplier?.name || order.vendorName || supplierEmail}`,
        userId,
        metadata: {
          supplierEmail,
          emailMessageId: emailResult.messageId,
          sentAt: new Date().toISOString()
        }
      }
    })

    // Update all items to ORDERED status
    await prisma.orderItem.updateMany({
      where: { orderId: id },
      data: { status: 'ORDERED' }
    })

    // Update spec items status to ORDERED
    const roomFFEItemIds = order.items.map(item => item.roomFFEItemId)
    if (roomFFEItemIds.length > 0) {
      await prisma.roomFFEItem.updateMany({
        where: { id: { in: roomFFEItemIds } },
        data: { specStatus: 'ORDERED' }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Purchase order sent to ${supplierEmail}`,
      emailMessageId: emailResult.messageId,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: 'ORDERED'
      }
    })

  } catch (error) {
    console.error('Error sending purchase order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send purchase order' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders/[id]/send
 * Preview the PO email (returns HTML)
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

    // Fetch order with full details
    const order = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactName: true,
            phone: true,
            address: true
          }
        },
        items: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
                sku: true,
                color: true,
                finish: true,
                images: true,
                notes: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Get organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        logo: true,
        phone: true,
        email: true,
        address: true
      }
    })

    // Build preview email data
    const emailData: PurchaseOrderEmailData = {
      poNumber: order.orderNumber,
      supplierName: order.supplier?.name || order.vendorName || 'Supplier',
      supplierContactName: order.supplier?.contactName || undefined,
      projectName: order.project.name,
      projectAddress: order.project.address,
      companyName: organization?.name || 'Meisner Interiors',
      companyLogo: organization?.logo || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://residentone-workflow.vercel.app'}/meisnerinteriorlogo.png`,
      companyPhone: organization?.phone || undefined,
      companyEmail: organization?.email || 'projects@meisnerinteriors.com',
      companyAddress: organization?.address || undefined,
      items: order.items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unitType,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString()),
        sku: item.roomFFEItem?.sku || null,
        brand: item.roomFFEItem?.brand || null,
        color: item.roomFFEItem?.color || null,
        finish: item.roomFFEItem?.finish || null,
        notes: item.notes || item.roomFFEItem?.notes || null,
        images: item.roomFFEItem?.images as string[] || null
      })),
      subtotal: parseFloat(order.subtotal?.toString() || '0'),
      taxAmount: order.taxAmount ? parseFloat(order.taxAmount.toString()) : undefined,
      shippingCost: order.shippingCost ? parseFloat(order.shippingCost.toString()) : undefined,
      totalAmount: parseFloat(order.totalAmount?.toString() || '0'),
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      shippingMethod: order.shippingMethod,
      expectedDelivery: order.expectedDelivery,
      notes: order.notes,
      paymentTerms: 'Net 30',
      orderDate: order.createdAt
    }

    const { subject, html } = generatePurchaseOrderEmailTemplate(emailData)

    // Return preview data
    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        supplierName: order.supplier?.name || order.vendorName,
        supplierEmail: order.supplier?.email || order.vendorEmail,
        totalAmount: parseFloat(order.totalAmount?.toString() || '0'),
        itemCount: order.items.length
      },
      email: {
        subject,
        html,
        to: order.supplier?.email || order.vendorEmail || 'No email configured'
      }
    })

  } catch (error) {
    console.error('Error generating PO preview:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    )
  }
}
