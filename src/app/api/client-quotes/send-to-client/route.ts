import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { generateClientQuoteEmailTemplate } from '@/lib/email-templates'
import { calculateQuebecTaxes, QUEBEC_TAX_RATES } from '@/lib/tax-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-quotes/send-to-client
 * Create a client quote from spec items and send email to client
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session
    let orgId = (session.user as any).orgId
    const userId = (session.user as any).id

    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true, id: true }
      })
      orgId = user?.orgId
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const body = await request.json()
    const {
      projectId,
      itemIds,
      clientEmail,
      clientName,
      note,
      validUntil,
      gstRate = QUEBEC_TAX_RATES.GST,
      qstRate = QUEBEC_TAX_RATES.QST
    } = body

    if (!projectId || !itemIds?.length || !clientEmail) {
      return NextResponse.json(
        { error: 'Project ID, item IDs, and client email are required' },
        { status: 400 }
      )
    }

    // Fetch project and organization info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        logoUrl: true,
        businessName: true,
        businessPhone: true,
        businessEmail: true,
        gstNumber: true,
        qstNumber: true,
        defaultGstRate: true,
        defaultQstRate: true
      }
    })

    // Fetch the spec items
    const items = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: itemIds }
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: true
              }
            }
          }
        }
      }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 })
    }

    // Calculate pricing with markup - round to 2 decimal places
    let subtotal = 0
    const lineItemsData = items.map(item => {
      // Get trade price (cost) and markup
      const costPrice = Math.round(Number(item.tradePrice || item.unitCost || 0) * 100) / 100
      const itemMarkup = item.markupPercent ? Number(item.markupPercent) : 0

      // Calculate selling price: if markup is set, apply it to trade price
      // If no markup but RRP exists, use RRP as selling price
      let sellingPrice: number
      if (itemMarkup > 0 && costPrice > 0) {
        sellingPrice = Math.round(costPrice * (1 + itemMarkup / 100) * 100) / 100
      } else if (item.rrp) {
        sellingPrice = Math.round(Number(item.rrp) * 100) / 100
      } else {
        sellingPrice = costPrice
      }

      const clientTotal = Math.round(sellingPrice * item.quantity * 100) / 100
      const supplierTotal = Math.round(costPrice * item.quantity * 100) / 100
      const markupAmount = Math.round((sellingPrice - costPrice) * item.quantity * 100) / 100
      subtotal += clientTotal

      return {
        roomFFEItemId: item.id,
        displayName: item.name,
        displayDescription: item.description || '',
        categoryName: item.section?.name || 'Uncategorized',
        roomName: item.section?.instance?.room?.name || '',
        quantity: item.quantity,
        unitType: item.unitType || 'units',
        clientUnitPrice: sellingPrice,
        clientTotalPrice: clientTotal,
        supplierUnitPrice: costPrice,
        supplierTotalPrice: supplierTotal,
        markupType: 'PERCENTAGE',
        markupValue: itemMarkup,
        markupAmount: markupAmount,
        order: 0
      }
    })
    // Round subtotal to 2 decimal places
    subtotal = Math.round(subtotal * 100) / 100

    // Calculate taxes
    const effectiveGstRate = Number(gstRate) || Number(organization?.defaultGstRate) || QUEBEC_TAX_RATES.GST
    const effectiveQstRate = Number(qstRate) || Number(organization?.defaultQstRate) || QUEBEC_TAX_RATES.QST
    const taxes = calculateQuebecTaxes(subtotal, effectiveGstRate, effectiveQstRate)

    // Generate quote number
    const year = new Date().getFullYear()
    const existingQuotes = await prisma.clientQuote.count({
      where: {
        orgId,
        quoteNumber: { startsWith: `CQ-${year}` }
      }
    })
    const quoteNumber = `CQ-${year}-${String(existingQuotes + 1).padStart(4, '0')}`

    // Create the client quote
    const clientQuote = await prisma.clientQuote.create({
      data: {
        orgId,
        projectId,
        quoteNumber,
        title: `Quote for ${project.name}`,
        description: note || '',
        status: 'SENT_TO_CLIENT',
        subtotal,
        gstRate: effectiveGstRate,
        gstAmount: taxes.gstAmount,
        qstRate: effectiveQstRate,
        qstAmount: taxes.qstAmount,
        taxRate: effectiveGstRate + effectiveQstRate,
        taxAmount: taxes.gstAmount + taxes.qstAmount,
        totalAmount: taxes.total,
        currency: 'CAD',
        validUntil: validUntil ? new Date(validUntil) : null,
        clientName: clientName || project.client?.name || '',
        clientEmail,
        sentToClientAt: new Date(),
        sentById: userId,
        createdById: userId,
        updatedById: userId,
        lineItems: {
          create: lineItemsData
        }
      },
      include: {
        lineItems: true
      }
    })

    // Create activity log for each item
    for (const item of items) {
      await prisma.itemActivity.create({
        data: {
          itemId: item.id,
          type: 'SENT_TO_CLIENT_QUOTE',
          title: 'Sent to Client',
          description: `Item included in quote ${quoteNumber}`,
          actorId: userId,
          actorName: session.user.name || session.user.email || 'Unknown',
          actorType: 'user',
          metadata: {
            quoteId: clientQuote.id,
            quoteNumber,
            clientEmail
          }
        }
      })
    }

    // Create client quote activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: clientQuote.id,
        type: 'SENT_TO_CLIENT',
        description: `Quote sent to ${clientEmail}`,
        userId
      }
    })

    // Generate and send email
    // Use request origin or fallback to env variable
    const host = request.headers.get('host') || ''
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const quoteUrl = `${baseUrl}/quote/${clientQuote.accessToken}`

    // Convert relative logo URL to absolute URL for email
    let companyLogo: string | undefined = undefined
    if (organization?.logoUrl) {
      companyLogo = organization.logoUrl.startsWith('http')
        ? organization.logoUrl
        : `${baseUrl}${organization.logoUrl.startsWith('/') ? '' : '/'}${organization.logoUrl}`
    }

    const emailData = {
      quoteNumber,
      clientName: clientName || project.client?.name || 'Valued Client',
      projectName: project.name,
      companyName: organization?.businessName || organization?.name || 'Meisner Interiors',
      companyLogo,
      companyPhone: organization?.businessPhone || undefined,
      companyEmail: organization?.businessEmail || undefined,
      quoteUrl,
      validUntil: clientQuote.validUntil || undefined,
      lineItems: clientQuote.lineItems.map(li => ({
        name: li.displayName,
        quantity: li.quantity,
        unitPrice: Number(li.clientUnitPrice),
        total: Number(li.clientTotalPrice)
      })),
      subtotal: Number(clientQuote.subtotal),
      gstRate: effectiveGstRate,
      gstAmount: Number(clientQuote.gstAmount),
      qstRate: effectiveQstRate,
      qstAmount: Number(clientQuote.qstAmount),
      total: Number(clientQuote.totalAmount),
      note: note || undefined
    }

    const emailTemplate = generateClientQuoteEmailTemplate(emailData)

    // Send the email
    await sendEmail({
      to: clientEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })

    // Log email sent
    await prisma.clientQuoteEmailLog.create({
      data: {
        clientQuoteId: clientQuote.id,
        emailType: 'QUOTE_SENT',
        recipientEmail: clientEmail,
        subject: emailTemplate.subject,
        sentAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      quoteId: clientQuote.id,
      quoteNumber,
      accessToken: clientQuote.accessToken
    })
  } catch (error) {
    console.error('Error sending quote to client:', error)
    return NextResponse.json(
      { error: 'Failed to send quote to client' },
      { status: 500 }
    )
  }
}
