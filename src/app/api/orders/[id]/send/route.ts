import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { generatePurchaseOrderEmailTemplate, PurchaseOrderEmailData } from '@/lib/email-templates'
import { decrypt, formatExpiry } from '@/lib/encryption'

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
      billingAddress: overrideBillingAddress,
      expectedDelivery,
      paymentTerms,
      savedPaymentMethodId,
      isTest // Flag for test emails - don't update order status
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
                notes: true,
                leadTime: true
              }
            },
            supplierQuoteLineItem: {
              select: {
                leadTime: true,
                leadTimeWeeks: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate expected delivery from lead time if not provided
    let calculatedExpectedDelivery = expectedDelivery ? new Date(expectedDelivery) : order.expectedDelivery

    if (!calculatedExpectedDelivery) {
      // Find the maximum lead time from items
      let maxLeadTimeWeeks = 0
      for (const item of order.items) {
        const leadTime = item.supplierQuoteLineItem?.leadTime || item.roomFFEItem?.leadTime
        const leadTimeWeeks = item.supplierQuoteLineItem?.leadTimeWeeks

        if (leadTimeWeeks && leadTimeWeeks > maxLeadTimeWeeks) {
          maxLeadTimeWeeks = leadTimeWeeks
        } else if (leadTime) {
          // Parse lead time string (e.g., "2-4 Weeks", "4-6 Weeks", "In Stock")
          const weekMatch = leadTime.match(/(\d+)-?(\d+)?\s*weeks?/i)
          if (weekMatch) {
            const weeks = parseInt(weekMatch[2] || weekMatch[1]) // Use upper bound if range
            if (weeks > maxLeadTimeWeeks) {
              maxLeadTimeWeeks = weeks
            }
          } else if (leadTime.toLowerCase().includes('in stock') || leadTime.toLowerCase().includes('in-stock')) {
            // In stock = 1 week default
            if (1 > maxLeadTimeWeeks) maxLeadTimeWeeks = 1
          }
        }
      }

      if (maxLeadTimeWeeks > 0) {
        calculatedExpectedDelivery = new Date()
        calculatedExpectedDelivery.setDate(calculatedExpectedDelivery.getDate() + (maxLeadTimeWeeks * 7))
      }
    }

    // Generate supplier portal URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.meisnerinteriors.com'
    const supplierPortalUrl = order.supplierAccessToken
      ? `${baseUrl}/supplier-order/${order.supplierAccessToken}`
      : undefined

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
        businessName: true,
        logoUrl: true,
        businessPhone: true,
        businessEmail: true,
        businessAddress: true
      }
    })

    // Determine billing address (use override, or org address)
    const billingAddress = overrideBillingAddress || organization?.businessAddress || null

    // Get payment method details if provided
    let paymentInfo: {
      cardBrand?: string
      lastFour?: string
      holderName?: string
      expiry?: string
      cardNumber?: string
      cvv?: string
    } | null = null

    if (savedPaymentMethodId) {
      const paymentMethod = await prisma.savedPaymentMethod.findFirst({
        where: { id: savedPaymentMethodId, orgId }
      })

      if (paymentMethod) {
        paymentInfo = {
          cardBrand: paymentMethod.cardBrand || undefined,
          lastFour: paymentMethod.lastFour || undefined,
          holderName: paymentMethod.holderName || undefined,
          expiry: paymentMethod.expiryMonth && paymentMethod.expiryYear
            ? formatExpiry(paymentMethod.expiryMonth, paymentMethod.expiryYear)
            : undefined,
          // Decrypt full card details for supplier to charge
          cardNumber: paymentMethod.encryptedCardNumber
            ? decrypt(paymentMethod.encryptedCardNumber)
            : undefined,
          cvv: paymentMethod.encryptedCvv
            ? decrypt(paymentMethod.encryptedCvv)
            : undefined
        }
      }
    }

    // Build email data
    const emailData: PurchaseOrderEmailData = {
      poNumber: order.orderNumber,
      supplierName: order.supplier?.name || order.vendorName || 'Supplier',
      supplierContactName: order.supplier?.contactName || undefined,
      projectName: order.project.name,
      projectAddress: order.project.address,
      companyName: organization?.businessName || organization?.name || 'Meisner Interiors',
      companyLogo: organization?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png',
      companyPhone: organization?.businessPhone || undefined,
      companyEmail: organization?.businessEmail || 'projects@meisnerinteriors.com',
      companyAddress: organization?.businessAddress || undefined,
      billingAddress,
      supplierPortalUrl,
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
      extraCharges: order.extraCharges as Array<{ label: string; amount: number }> | null,
      totalAmount: parseFloat(order.totalAmount?.toString() || '0'),
      currency: order.currency,
      // Deposit info
      depositPercent: order.depositPercent ? parseFloat(order.depositPercent.toString()) : undefined,
      depositRequired: order.depositRequired ? parseFloat(order.depositRequired.toString()) : undefined,
      balanceDue: order.depositRequired
        ? parseFloat(order.totalAmount?.toString() || '0') - parseFloat(order.depositRequired.toString())
        : undefined,
      shippingAddress: overrideShippingAddress || order.shippingAddress,
      shippingMethod: order.shippingMethod,
      expectedDelivery: calculatedExpectedDelivery || null,
      notes: additionalNotes || order.notes,
      paymentTerms: paymentTerms || 'Net 30',
      orderDate: order.createdAt,
      // Payment method info for supplier
      paymentMethod: paymentInfo || undefined
    }

    // Generate email
    const { subject, html } = generatePurchaseOrderEmailTemplate(emailData)

    // Send email
    const emailResult = await sendEmail({
      to: supplierEmail,
      subject,
      html
    })

    // Only update order status if not a test email
    if (!isTest) {
      // Update order status, timestamps, and payment info
      await prisma.order.update({
        where: { id },
        data: {
          status: 'ORDERED',
          orderedAt: new Date(),
          notes: additionalNotes || order.notes,
          shippingAddress: overrideShippingAddress || order.shippingAddress,
          billingAddress: billingAddress,
          expectedDelivery: calculatedExpectedDelivery,
          savedPaymentMethodId: savedPaymentMethodId || null,
          // Store payment card info for reference
          paymentCardBrand: paymentInfo?.cardBrand || null,
          paymentCardLastFour: paymentInfo?.lastFour || null,
          paymentCardHolderName: paymentInfo?.holderName || null,
          paymentCardExpiry: paymentInfo?.expiry || null,
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
            sentAt: new Date().toISOString(),
            hasPaymentInfo: !!paymentInfo
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
    }

    return NextResponse.json({
      success: true,
      message: isTest
        ? `Test email sent to ${supplierEmail}`
        : `Purchase order sent to ${supplierEmail}`,
      emailMessageId: emailResult.messageId,
      supplierPortalUrl,
      expectedDelivery: calculatedExpectedDelivery?.toISOString(),
      isTest,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: isTest ? order.status : 'ORDERED'
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
        businessName: true,
        logoUrl: true,
        businessPhone: true,
        businessEmail: true,
        businessAddress: true
      }
    })

    // Build preview email data
    const emailData: PurchaseOrderEmailData = {
      poNumber: order.orderNumber,
      supplierName: order.supplier?.name || order.vendorName || 'Supplier',
      supplierContactName: order.supplier?.contactName || undefined,
      projectName: order.project.name,
      projectAddress: order.project.address,
      companyName: organization?.businessName || organization?.name || 'Meisner Interiors',
      companyLogo: organization?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png',
      companyPhone: organization?.businessPhone || undefined,
      companyEmail: organization?.businessEmail || 'projects@meisnerinteriors.com',
      companyAddress: organization?.businessAddress || undefined,
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
      extraCharges: order.extraCharges as Array<{ label: string; amount: number }> | null,
      totalAmount: parseFloat(order.totalAmount?.toString() || '0'),
      currency: order.currency,
      // Deposit info
      depositPercent: order.depositPercent ? parseFloat(order.depositPercent.toString()) : undefined,
      depositRequired: order.depositRequired ? parseFloat(order.depositRequired.toString()) : undefined,
      balanceDue: order.depositRequired
        ? parseFloat(order.totalAmount?.toString() || '0') - parseFloat(order.depositRequired.toString())
        : undefined,
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
