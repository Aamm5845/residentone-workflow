import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generatePOPdf } from '@/lib/po-pdf-generator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/[id]/pdf
 * Download Purchase Order as PDF
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
            address: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
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
                unitType: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch organization details for the PDF header
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        logoUrl: true,
        businessName: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        businessCountry: true,
        businessPhone: true,
        businessEmail: true,
        neqNumber: true,
        gstNumber: true,
        qstNumber: true
      }
    })

    // Calculate deposit and payment values
    const totalAmount = parseFloat(order.totalAmount?.toString() || '0')
    const depositRequired = parseFloat(order.depositRequired?.toString() || '0')
    const depositPercent = parseFloat(order.depositPercent?.toString() || '0')
    const depositPaid = parseFloat(order.depositPaid?.toString() || '0')
    const supplierPaymentAmount = parseFloat(order.supplierPaymentAmount?.toString() || '0')
    const balanceDue = Math.max(0, totalAmount - supplierPaymentAmount)

    // Build PO data for PDF
    const poData = {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      orderedAt: order.orderedAt,
      expectedDelivery: order.expectedDelivery,

      // Vendor info
      vendorName: order.supplier?.name || order.vendorName || 'Vendor',
      vendorEmail: order.supplier?.email || order.vendorEmail,
      vendorPhone: order.supplier?.phone,
      vendorAddress: order.supplier?.address,

      // Project info
      projectName: order.project.name,
      projectAddress: order.project.address,

      // Shipping
      shippingAddress: order.shippingAddress,
      shippingMethod: order.shippingMethod,

      // Line items
      lineItems: order.items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unitType || item.roomFFEItem?.unitType,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString())
      })),

      // Pricing
      subtotal: parseFloat(order.subtotal?.toString() || '0'),
      shippingCost: parseFloat(order.shippingCost?.toString() || '0'),
      extraCharges: order.extraCharges as Array<{ label: string; amount: number }> | null,
      taxAmount: parseFloat(order.taxAmount?.toString() || '0'),
      totalAmount: totalAmount,
      currency: order.currency || 'CAD',

      // Deposit
      depositPercent: depositPercent > 0 ? depositPercent : null,
      depositRequired: depositRequired > 0 ? depositRequired : null,
      depositPaid: depositPaid > 0 ? depositPaid : null,

      // Payment
      amountPaid: supplierPaymentAmount > 0 ? supplierPaymentAmount : null,
      balanceDue: balanceDue > 0 ? balanceDue : null,

      // Notes
      notes: order.notes,
      paymentTerms: 'Net 30'
    }

    const organizationData = {
      name: organization?.name || 'Company',
      logoUrl: organization?.logoUrl,
      businessName: organization?.businessName,
      businessAddress: organization?.businessAddress,
      businessCity: organization?.businessCity,
      businessProvince: organization?.businessProvince,
      businessPostal: organization?.businessPostal,
      businessCountry: organization?.businessCountry,
      businessPhone: organization?.businessPhone,
      businessEmail: organization?.businessEmail,
      neqNumber: organization?.neqNumber,
      gstNumber: organization?.gstNumber,
      qstNumber: organization?.qstNumber
    }

    // Generate PDF
    const pdfBuffer = await generatePOPdf(poData, organizationData)

    // Return PDF as download
    const filename = `PO-${order.orderNumber}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating PO PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
