import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateClientQuotePDF } from '@/lib/pdf-generator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-quotes/[id]/pdf
 * Generate and download a PDF for the client quote
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

    // Get the client quote with all related data
    const quote = await prisma.clientQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          include: {
            client: true
          }
        },
        lineItems: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get organization info for company details
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true
      }
    })

    // Prepare data for PDF generation
    const pdfData = {
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      description: quote.description,
      projectName: quote.project.name,
      clientName: quote.project.client?.name || 'Client',
      clientEmail: quote.project.client?.email,
      clientPhone: quote.project.client?.phone,
      clientAddress: quote.project.client?.address,
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      paymentTerms: quote.paymentTerms,
      depositRequired: quote.depositRequired,
      depositAmount: quote.depositAmount ? parseFloat(quote.depositAmount.toString()) : undefined,
      lineItems: quote.lineItems.map(item => ({
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        quantity: item.quantity,
        unitType: item.unitType || 'units',
        sellingPrice: parseFloat(item.sellingPrice?.toString() || '0'),
        totalPrice: parseFloat(item.totalPrice?.toString() || '0'),
        groupId: item.groupId
      })),
      subtotal: parseFloat(quote.subtotal?.toString() || '0'),
      taxRate: quote.taxRate ? parseFloat(quote.taxRate.toString()) : undefined,
      taxAmount: quote.taxAmount ? parseFloat(quote.taxAmount.toString()) : undefined,
      shippingCost: quote.shippingCost ? parseFloat(quote.shippingCost.toString()) : undefined,
      totalAmount: quote.totalAmount ? parseFloat(quote.totalAmount.toString()) : undefined,
      companyName: org?.name || 'Meisner Interiors',
      companyAddress: org?.address || undefined,
      companyPhone: org?.phone || undefined,
      companyEmail: org?.email || undefined,
      companyLogo: org?.logo || undefined
    }

    // Generate PDF
    const pdfBytes = await generateClientQuotePDF(pdfData)

    // Create filename
    const filename = `${quote.quoteNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_${quote.project.name.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    // Return PDF as download
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/client-quotes/[id]/pdf
 * Generate PDF and optionally save to Dropbox/attach to quote
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
    const { saveToDropbox = false, attachToQuote = true } = body

    const orgId = (session.user as any).orgId
    const userId = (session.user as any).id

    // Get the client quote
    const quote = await prisma.clientQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          include: {
            client: true
          }
        },
        lineItems: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get organization info
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true
      }
    })

    // Generate PDF
    const pdfData = {
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      description: quote.description,
      projectName: quote.project.name,
      clientName: quote.project.client?.name || 'Client',
      clientEmail: quote.project.client?.email,
      clientPhone: quote.project.client?.phone,
      clientAddress: quote.project.client?.address,
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      paymentTerms: quote.paymentTerms,
      depositRequired: quote.depositRequired,
      depositAmount: quote.depositAmount ? parseFloat(quote.depositAmount.toString()) : undefined,
      lineItems: quote.lineItems.map(item => ({
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        quantity: item.quantity,
        unitType: item.unitType || 'units',
        sellingPrice: parseFloat(item.sellingPrice?.toString() || '0'),
        totalPrice: parseFloat(item.totalPrice?.toString() || '0'),
        groupId: item.groupId
      })),
      subtotal: parseFloat(quote.subtotal?.toString() || '0'),
      taxRate: quote.taxRate ? parseFloat(quote.taxRate.toString()) : undefined,
      taxAmount: quote.taxAmount ? parseFloat(quote.taxAmount.toString()) : undefined,
      shippingCost: quote.shippingCost ? parseFloat(quote.shippingCost.toString()) : undefined,
      totalAmount: quote.totalAmount ? parseFloat(quote.totalAmount.toString()) : undefined,
      companyName: org?.name || 'Meisner Interiors',
      companyAddress: org?.address || undefined,
      companyPhone: org?.phone || undefined,
      companyEmail: org?.email || undefined
    }

    const pdfBytes = await generateClientQuotePDF(pdfData)
    const filename = `${quote.quoteNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    let documentId: string | undefined
    let fileUrl = ''
    let dropboxPath = ''

    // Optionally save to Dropbox
    if (saveToDropbox && quote.project.dropboxFolder) {
      const { dropboxService } = await import('@/lib/dropbox-service')

      if (dropboxService.isConfigured()) {
        try {
          const result = await dropboxService.uploadFFEFile(
            quote.project.dropboxFolder,
            'Quotes',
            'Quotes',
            filename,
            Buffer.from(pdfBytes)
          )
          dropboxPath = result.path

          // Get shared link
          try {
            fileUrl = await dropboxService.createSharedLink(dropboxPath) || ''
          } catch (e) {
            console.warn('Could not create shared link:', e)
          }
        } catch (e) {
          console.error('Dropbox upload failed:', e)
        }
      }
    }

    // Optionally create document record
    if (attachToQuote) {
      const document = await prisma.rFQDocument.create({
        data: {
          orgId,
          clientQuoteId: id,
          type: 'QUOTE',
          title: `${quote.quoteNumber} - Client Quote`,
          fileName: filename,
          fileUrl: fileUrl || `local:${filename}`,
          fileSize: pdfBytes.length,
          mimeType: 'application/pdf',
          provider: dropboxPath ? 'dropbox' : 'generated',
          dropboxPath: dropboxPath || null,
          visibleToClient: true,
          visibleToSupplier: false,
          uploadedById: userId
        }
      })
      documentId = document.id
    }

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: id,
        type: 'PDF_GENERATED',
        message: `PDF generated${saveToDropbox ? ' and saved to Dropbox' : ''}`,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      documentId,
      dropboxPath: dropboxPath || null,
      fileUrl: fileUrl || null
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
