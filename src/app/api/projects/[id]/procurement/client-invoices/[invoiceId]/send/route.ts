// Send invoice to client via email
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'
import { generateClientQuoteEmailTemplate } from '@/lib/email-templates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const { id: projectId, invoiceId } = await params
    const body = await request.json()
    const { email, subject, message } = body

    // Fetch invoice with org info and line item images
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        lineItems: {
          select: {
            id: true,
            displayName: true,
            quantity: true,
            clientTotalPrice: true,
            order: true,
            roomFFEItemId: true,
            roomFFEItem: {
              select: {
                images: true,
                brand: true,
                modelNumber: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true
              }
            },
            organization: {
              select: {
                name: true,
                businessName: true,
                businessEmail: true,
                businessPhone: true,
                logoUrl: true,
                etransferEmail: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const clientEmail = email || invoice.clientEmail || invoice.project.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: 'No client email address provided' }, { status: 400 })
    }

    // Generate invoice link (always uses production URL on Vercel)
    const baseUrl = getBaseUrl()
    const invoiceLink = `${baseUrl}/client/invoice/${invoice.accessToken}`

    // Build email content using shared template (same as test email)
    const orgName = invoice.project.organization?.businessName || invoice.project.organization?.name || 'Your Designer'
    const clientName = invoice.clientName || invoice.project.client?.name || 'Client'

    // Generate professional email using shared template
    const emailTemplate = generateClientQuoteEmailTemplate({
      quoteNumber: invoice.quoteNumber,
      clientName,
      clientAddress: invoice.clientAddress || undefined,
      projectName: invoice.project.name,
      title: invoice.title || undefined,
      companyName: orgName,
      companyLogo: invoice.project.organization?.logoUrl || undefined,
      companyPhone: invoice.project.organization?.businessPhone || undefined,
      companyEmail: invoice.project.organization?.businessEmail || undefined,
      quoteUrl: invoiceLink,
      validUntil: invoice.validUntil || undefined,
      // Line items not shown in email - client clicks link to see details
      lineItems: [],
      subtotal: Number(invoice.subtotal),
      gstRate: Number(invoice.gstRate) || 5,
      gstAmount: Number(invoice.gstAmount) || 0,
      qstRate: Number(invoice.qstRate) || 9.975,
      qstAmount: Number(invoice.qstAmount) || 0,
      total: Number(invoice.totalAmount),
      note: message || undefined
    })

    // Use custom subject if provided, otherwise use template subject
    const emailSubject = subject || emailTemplate.subject
    const emailHtml = emailTemplate.html

    // Send email using centralized email service
    const trackingId = `${invoiceId}-${Date.now()}`

    try {
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: emailSubject,
        html: emailHtml
      })

      console.log('Email sent successfully:', emailResult.messageId, 'to:', clientEmail)

      // Log email
      await prisma.clientQuoteEmailLog.create({
        data: {
          clientQuoteId: invoiceId,
          to: clientEmail,
          subject: emailSubject,
          htmlContent: emailHtml,
          trackingPixelId: trackingId
        }
      })
    } catch (emailError: any) {
      console.error('Email send error:', emailError)
      return NextResponse.json({
        error: emailError.message || 'Failed to send email',
        details: emailError.message
      }, { status: 500 })
    }

    // Update invoice status
    await prisma.clientQuote.update({
      where: { id: invoiceId },
      data: {
        status: 'SENT_TO_CLIENT',
        sentToClientAt: new Date(),
        sentById: userId,
        clientEmail: clientEmail // Update client email if provided
      }
    })

    // Update all linked RoomFFEItems to INVOICED_TO_CLIENT status
    const roomFFEItemIds = invoice.lineItems
      .filter(li => li.roomFFEItemId)
      .map(li => li.roomFFEItemId as string)

    if (roomFFEItemIds.length > 0) {
      await prisma.roomFFEItem.updateMany({
        where: {
          id: { in: roomFFEItemIds },
          // Only update items that are in earlier procurement stages
          specStatus: {
            in: ['DRAFT', 'SELECTED', 'RFQ_SENT', 'QUOTE_RECEIVED', 'QUOTE_APPROVED', 'BUDGET_SENT', 'BUDGET_APPROVED']
          }
        },
        data: {
          specStatus: 'INVOICED_TO_CLIENT',
          paymentStatus: 'INVOICED'
        }
      })
    }

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoiceId,
        type: 'SENT',
        message: `Invoice sent to ${clientEmail}`,
        userId: userId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${clientEmail}`,
      invoiceLink
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
