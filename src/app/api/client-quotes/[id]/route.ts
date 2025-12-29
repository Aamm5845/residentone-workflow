import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-quotes/[id]
 * Get a specific client quote with full details
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

    const quote = await prisma.clientQuote.findFirst({
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
                email: true,
                phone: true
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
                section: {
                  select: {
                    name: true
                  }
                }
              }
            },
            supplierQuote: {
              select: {
                id: true,
                quoteNumber: true,
                supplierRFQ: {
                  select: {
                    supplier: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        payments: {
          include: {
            confirmedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' }
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

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Calculate profit margins
    const profitAnalysis = {
      totalCost: quote.lineItems.reduce((sum, item) => sum + parseFloat(item.totalCost?.toString() || '0'), 0),
      totalRevenue: parseFloat(quote.subtotal?.toString() || '0'),
      grossProfit: 0,
      marginPercent: 0
    }
    profitAnalysis.grossProfit = profitAnalysis.totalRevenue - profitAnalysis.totalCost
    profitAnalysis.marginPercent = profitAnalysis.totalRevenue > 0
      ? (profitAnalysis.grossProfit / profitAnalysis.totalRevenue) * 100
      : 0

    return NextResponse.json({ quote, profitAnalysis })
  } catch (error) {
    console.error('Error fetching client quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch client quote' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/client-quotes/[id]
 * Update a client quote
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

    const existing = await prisma.clientQuote.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Can't modify if already approved
    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot modify an approved quote' },
        { status: 400 }
      )
    }

    const {
      title,
      description,
      validUntil,
      paymentTerms,
      depositRequired,
      depositAmount,
      taxRate,
      shippingCost,
      status
    } = body

    // Recalculate totals if pricing fields change
    let updateData: any = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(depositRequired !== undefined && { depositRequired }),
      ...(depositAmount !== undefined && { depositAmount }),
      ...(taxRate !== undefined && { taxRate }),
      ...(shippingCost !== undefined && { shippingCost }),
      ...(status !== undefined && { status }),
      updatedById: userId
    }

    // Recalculate tax and total if tax rate or shipping changes
    if (taxRate !== undefined || shippingCost !== undefined) {
      const subtotal = parseFloat(existing.subtotal?.toString() || '0')
      const newTaxRate = taxRate !== undefined ? taxRate : parseFloat(existing.taxRate?.toString() || '0')
      const newShipping = shippingCost !== undefined ? shippingCost : parseFloat(existing.shippingCost?.toString() || '0')

      const taxAmount = subtotal * (newTaxRate / 100)
      const totalAmount = subtotal + taxAmount + newShipping

      updateData.taxAmount = taxAmount
      updateData.totalAmount = totalAmount
    }

    const quote = await prisma.clientQuote.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true }
        },
        lineItems: true
      }
    })

    // Log status changes
    if (status && status !== existing.status) {
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: id,
          type: 'STATUS_CHANGED',
          message: `Status changed from ${existing.status} to ${status}`,
          userId
        }
      })
    }

    return NextResponse.json({ quote })
  } catch (error) {
    console.error('Error updating client quote:', error)
    return NextResponse.json(
      { error: 'Failed to update client quote' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/client-quotes/[id]
 * Send quote to client or record client response
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
    const { action, clientEmail, clientMessage, decision } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const quote = await prisma.clientQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          include: {
            client: true
          }
        },
        lineItems: true
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (action === 'send') {
      // Send quote to client
      const email = clientEmail || quote.project.client?.email
      if (!email) {
        return NextResponse.json({ error: 'Client email not found' }, { status: 400 })
      }

      const baseUrl = getBaseUrl()
      const trackingId = `cq-${id}-${Date.now()}`

      // Generate quote view URL (public page)
      const viewUrl = `${baseUrl}/quote/${quote.quoteNumber}`

      await sendEmail({
        to: email,
        subject: `Quote for ${quote.title} - ${quote.project.name}`,
        html: generateClientQuoteEmail(quote, viewUrl, trackingId)
      })

      // Create email log
      await prisma.clientQuoteEmailLog.create({
        data: {
          clientQuoteId: id,
          to: email,
          subject: `Quote for ${quote.title}`,
          htmlContent: 'Email sent', // Abbreviated for storage
          trackingPixelId: trackingId
        }
      })

      // Update quote status
      await prisma.clientQuote.update({
        where: { id },
        data: {
          status: 'SENT_TO_CLIENT',
          sentToClientAt: new Date(),
          sentById: userId,
          updatedById: userId
        }
      })

      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: id,
          type: 'SENT_TO_CLIENT',
          message: `Quote sent to ${email}`,
          userId
        }
      })

      return NextResponse.json({ success: true, sentTo: email })
    } else if (action === 'record_response') {
      // Record client's response
      if (!decision) {
        return NextResponse.json({ error: 'Decision is required' }, { status: 400 })
      }

      const newStatus = decision === 'approved' ? 'APPROVED' :
                       decision === 'rejected' ? 'REJECTED' :
                       decision === 'revision' ? 'REVISION_REQUESTED' : 'CLIENT_REVIEWING'

      await prisma.clientQuote.update({
        where: { id },
        data: {
          status: newStatus,
          clientDecision: decision,
          clientDecidedAt: new Date(),
          clientMessage: clientMessage || null,
          updatedById: userId
        }
      })

      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: id,
          type: `CLIENT_${decision.toUpperCase()}`,
          message: `Client ${decision} the quote${clientMessage ? `: ${clientMessage}` : ''}`,
          userId
        }
      })

      return NextResponse.json({ success: true, status: newStatus })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing client quote action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/client-quotes/[id]
 * Delete a client quote (only if in DRAFT status)
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

    const existing = await prisma.clientQuote.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft quotes can be deleted' },
        { status: 400 }
      )
    }

    await prisma.clientQuote.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete client quote' },
      { status: 500 }
    )
  }
}

function generateClientQuoteEmail(quote: any, viewUrl: string, trackingId: string) {
  const itemsList = quote.lineItems.slice(0, 5).map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.itemName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.sellingPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.totalPrice).toFixed(2)}</td>
    </tr>
  `).join('')

  const moreItems = quote.lineItems.length > 5 ? `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #6b7280;">... and ${quote.lineItems.length - 5} more items</td></tr>` : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote from ${quote.project.name}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Quote Ready for Review</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${quote.quoteNumber}</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <p>Dear ${quote.project.client?.name || 'Valued Client'},</p>

        <p>Your quote for <strong>${quote.project.name}</strong> is ready for review.</p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">${quote.title}</h2>
          ${quote.description ? `<p style="color: #6b7280; margin: 0;">${quote.description}</p>` : ''}
          ${quote.validUntil ? `<p style="margin: 10px 0 0 0; color: #dc2626;">Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}</p>` : ''}
        </div>

        <h3 style="color: #374151; margin-top: 25px;">Items Summary</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
            ${moreItems}
          </tbody>
          <tfoot>
            <tr style="background: #f3f4f6; font-weight: bold;">
              <td colspan="3" style="padding: 12px 8px; text-align: right;">Subtotal:</td>
              <td style="padding: 12px 8px; text-align: right;">$${parseFloat(quote.subtotal || 0).toFixed(2)}</td>
            </tr>
            ${quote.taxAmount ? `
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right;">Tax:</td>
              <td style="padding: 8px; text-align: right;">$${parseFloat(quote.taxAmount).toFixed(2)}</td>
            </tr>
            ` : ''}
            ${quote.totalAmount ? `
            <tr style="background: #10b981; color: white; font-weight: bold;">
              <td colspan="3" style="padding: 12px 8px; text-align: right;">Total:</td>
              <td style="padding: 12px 8px; text-align: right;">$${parseFloat(quote.totalAmount).toFixed(2)}</td>
            </tr>
            ` : ''}
          </tfoot>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${viewUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View Full Quote
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Click the button above to view the complete quote with all details and respond.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated message. Please do not reply directly to this email.</p>
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/api/email-tracking/${trackingId}/pixel.png" width="1" height="1" style="display: none;" />
      </div>
    </body>
    </html>
  `
}
