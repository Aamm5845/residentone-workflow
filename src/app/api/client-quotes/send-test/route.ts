import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { generateClientQuoteEmailTemplate } from '@/lib/email-templates'
import { calculateQuebecTaxes, QUEBEC_TAX_RATES } from '@/lib/tax-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-quotes/send-test
 * Create a real client quote/invoice and send to test email - works exactly like client would see
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      testEmail,
      projectId,
      lineItems,
      title,
      description,
      paymentTerms,
      validDays,
      defaultMarkup,
      allowCreditCard,
      shippingCost,
      customFees,
      gstRate = QUEBEC_TAX_RATES.GST,
      qstRate = QUEBEC_TAX_RATES.QST
    } = body

    if (!testEmail) {
      return NextResponse.json({ error: 'Test email is required' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: 'Line items are required' }, { status: 400 })
    }

    // Get project and org info
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
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

    // Calculate subtotal from line items
    let subtotal = 0
    const processedLineItems = lineItems.map((item: any, index: number) => {
      const clientTotal = Math.round(item.clientUnitPrice * item.quantity * 100) / 100
      subtotal += clientTotal

      return {
        roomFFEItemId: item.roomFFEItemId || null,
        displayName: item.itemName || item.displayName,
        displayDescription: item.displayDescription || '',
        categoryName: item.categoryName || item.groupId || 'Items',
        roomName: item.roomName || '',
        imageUrl: item.imageUrl || null,
        isComponent: item.isComponent || false,
        quantity: item.quantity,
        unitType: item.unitType || 'units',
        clientUnitPrice: item.clientUnitPrice,
        clientTotalPrice: clientTotal,
        supplierUnitPrice: item.costPrice || item.supplierUnitPrice || 0,
        supplierTotalPrice: (item.costPrice || item.supplierUnitPrice || 0) * item.quantity,
        markupType: 'PERCENTAGE',
        markupValue: item.markupPercent || 0,
        markupAmount: clientTotal - ((item.costPrice || item.supplierUnitPrice || 0) * item.quantity),
        order: index
      }
    })

    subtotal = Math.round(subtotal * 100) / 100

    // Calculate additional fees
    const deliveryAmount = shippingCost ? parseFloat(shippingCost) : 0
    const customFeesTotal = customFees && Array.isArray(customFees)
      ? customFees.reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0)
      : 0

    // Taxable base includes items + delivery + custom fees
    const taxableBase = subtotal + deliveryAmount + customFeesTotal

    // Calculate taxes on taxable base
    const effectiveGstRate = Number(gstRate) || Number(organization?.defaultGstRate) || QUEBEC_TAX_RATES.GST
    const effectiveQstRate = Number(qstRate) || Number(organization?.defaultQstRate) || QUEBEC_TAX_RATES.QST
    const taxes = calculateQuebecTaxes(taxableBase, effectiveGstRate, effectiveQstRate)

    // Calculate valid until date
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (validDays || 30))

    // Generate quote number
    const year = new Date().getFullYear()
    const existingQuotes = await prisma.clientQuote.count({
      where: {
        orgId,
        quoteNumber: { startsWith: `CQ-${year}` }
      }
    })
    const quoteNumber = `CQ-${year}-${String(existingQuotes + 1).padStart(4, '0')}`

    // Get client name from test email
    const clientName = testEmail.split('@')[0].replace(/[._-]/g, ' ')
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // Create the client quote
    const clientQuote = await prisma.clientQuote.create({
      data: {
        orgId,
        projectId,
        quoteNumber,
        title: title || `Invoice for ${project.name}`,
        description: description || '',
        paymentTerms: paymentTerms || null,
        status: 'DRAFT',
        subtotal,
        shippingCost: deliveryAmount > 0 ? deliveryAmount : null,
        customFees: customFees && customFees.length > 0 ? customFees : null,
        gstRate: effectiveGstRate,
        gstAmount: taxes.gstAmount,
        qstRate: effectiveQstRate,
        qstAmount: taxes.qstAmount,
        taxRate: effectiveGstRate + effectiveQstRate,
        taxAmount: taxes.gstAmount + taxes.qstAmount,
        totalAmount: taxes.total,
        currency: 'CAD',
        validUntil,
        allowCreditCard: allowCreditCard !== false,
        clientName,
        clientEmail: testEmail,
        createdById: userId,
        updatedById: userId,
        lineItems: {
          create: processedLineItems
        }
      },
      include: {
        lineItems: true
      }
    })

    // Generate and send email - exactly like client would see
    // Use request origin or fallback to env variable
    const host = request.headers.get('host') || ''
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const quoteUrl = `${baseUrl}/client/invoice/${clientQuote.accessToken}`

    // Convert relative logo URL to absolute URL for email
    let companyLogo: string | undefined = undefined
    if (organization?.logoUrl) {
      companyLogo = organization.logoUrl.startsWith('http')
        ? organization.logoUrl
        : `${baseUrl}${organization.logoUrl.startsWith('/') ? '' : '/'}${organization.logoUrl}`
    }

    const emailData = {
      quoteNumber,
      clientName,
      projectName: project.name,
      companyName: organization?.businessName || organization?.name || 'Meisner Interiors',
      companyLogo,
      companyPhone: organization?.businessPhone || undefined,
      companyEmail: organization?.businessEmail || undefined,
      quoteUrl,
      validUntil,
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
      note: description || undefined
    }

    const emailTemplate = generateClientQuoteEmailTemplate(emailData)

    // Send the email
    await sendEmail({
      to: testEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      quoteId: clientQuote.id,
      quoteNumber,
      accessToken: clientQuote.accessToken,
      portalUrl: quoteUrl
    })
  } catch (error) {
    console.error('Error sending test client quote email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}
