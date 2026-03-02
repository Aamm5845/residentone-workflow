import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { generateChargeRequestEmailTemplate, ChargeRequestEmailData } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/[id]/request-charge
 * Send a charge request email to the supplier
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
      chargeType,       // 'REMAINING' | 'NEXT_MILESTONE' | 'CUSTOM'
      customAmount,     // number (only for CUSTOM)
      supplierEmail: overrideEmail,
      message
    } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Fetch order with project and supplier
    const order = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactName: true,
          }
        },
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate payment amounts
    const totalAmount = parseFloat(order.totalAmount?.toString() || '0')
    const depositRequired = parseFloat(order.depositRequired?.toString() || '0')
    const depositPaid = parseFloat(order.depositPaid?.toString() || '0')
    const supplierPaid = parseFloat(order.supplierPaymentAmount?.toString() || '0')
    const remaining = totalAmount - supplierPaid

    if (remaining <= 0) {
      return NextResponse.json(
        { error: 'This order is already fully paid' },
        { status: 400 }
      )
    }

    // Determine requested amount and milestone label based on charge type
    let requestedAmount: number
    let milestoneLabel: string

    switch (chargeType) {
      case 'REMAINING':
        requestedAmount = remaining
        milestoneLabel = 'Remaining Balance'
        break

      case 'NEXT_MILESTONE':
        if (depositRequired > 0 && depositPaid < depositRequired) {
          // Deposit not fully paid yet
          requestedAmount = depositRequired - depositPaid
          milestoneLabel = 'Deposit Payment'
        } else {
          // Deposit paid (or none required) — balance due
          requestedAmount = totalAmount - supplierPaid
          milestoneLabel = 'Balance Payment'
        }
        break

      case 'CUSTOM':
        if (!customAmount || customAmount <= 0) {
          return NextResponse.json(
            { error: 'Custom amount must be greater than 0' },
            { status: 400 }
          )
        }
        if (customAmount > remaining) {
          return NextResponse.json(
            { error: `Custom amount cannot exceed remaining balance of ${remaining.toFixed(2)}` },
            { status: 400 }
          )
        }
        requestedAmount = customAmount
        milestoneLabel = 'Custom Payment'
        break

      default:
        return NextResponse.json(
          { error: 'Invalid charge type. Must be REMAINING, NEXT_MILESTONE, or CUSTOM' },
          { status: 400 }
        )
    }

    // Determine supplier email
    const supplierEmail = overrideEmail || order.supplier?.email || order.vendorEmail
    if (!supplierEmail) {
      return NextResponse.json(
        { error: 'Supplier email is required' },
        { status: 400 }
      )
    }

    // Get organization branding
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        businessName: true,
        logoUrl: true,
        businessPhone: true,
        businessEmail: true,
      }
    })

    // Generate supplier portal URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.meisnerinteriors.com'
    const supplierPortalUrl = order.supplierAccessToken
      ? `${baseUrl}/supplier-order/${order.supplierAccessToken}`
      : undefined

    // Build email data
    const emailData: ChargeRequestEmailData = {
      poNumber: order.orderNumber,
      supplierName: order.supplier?.name || order.vendorName || 'Supplier',
      supplierContactName: order.supplier?.contactName || undefined,
      projectName: order.project.name,
      companyName: organization?.businessName || organization?.name || 'Meisner Interiors',
      companyLogo: organization?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png',
      companyPhone: organization?.businessPhone || undefined,
      companyEmail: organization?.businessEmail || 'projects@meisnerinteriors.com',
      supplierPortalUrl,
      requestedAmount,
      totalAmount,
      amountPaidToDate: supplierPaid,
      remainingBalance: remaining,
      milestoneLabel,
      currency: order.currency,
      message: message || undefined,
      orderDate: order.createdAt,
    }

    // Generate and send email
    const { subject, html } = generateChargeRequestEmailTemplate(emailData)

    const emailResult = await sendEmail({
      to: supplierEmail,
      subject,
      html
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: id,
        type: 'CHARGE_REQUESTED',
        message: `Payment request of ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: order.currency || 'CAD' }).format(requestedAmount)} sent to ${order.supplier?.name || order.vendorName || supplierEmail} (${milestoneLabel})`,
        userId,
        metadata: {
          supplierEmail,
          requestedAmount,
          milestoneLabel,
          chargeType,
          totalAmount,
          paidToDate: supplierPaid,
          remaining,
          emailMessageId: emailResult.messageId,
          sentAt: new Date().toISOString(),
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Charge request sent to ${supplierEmail}`,
      requestedAmount,
      milestoneLabel,
    })

  } catch (error) {
    console.error('Error sending charge request:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send charge request' },
      { status: 500 }
    )
  }
}
