//route for client invoices - uses ClientQuote model
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - List all client invoices for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Fetch invoices (ClientQuotes) with payment info
    const invoices = await prisma.clientQuote.findMany({
      where: {
        projectId,
        orgId,
        ...(status && status !== 'ALL' ? { status: status as any } : {})
      },
      include: {
        lineItems: {
          select: {
            id: true,
            displayName: true,
            quantity: true,
            clientTotalPrice: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            paidAt: true,
            notes: true
          }
        },
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        sentBy: {
          select: {
            name: true
          }
        },
        emailLogs: {
          select: {
            openedAt: true
          },
          where: {
            openedAt: { not: null }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform to invoice format with calculated fields
    const formattedInvoices = invoices.map(invoice => {
      const totalAmount = Number(invoice.totalAmount) || 0
      const paidAmount = invoice.payments
        .filter(p => p.status === 'PAID' || p.status === 'PARTIAL')
        .reduce((sum, p) => sum + Number(p.amount), 0)
      const balance = totalAmount - paidAmount

      // Determine invoice status
      let invoiceStatus: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'
      if (invoice.status === 'DRAFT') {
        invoiceStatus = 'DRAFT'
      } else if (paidAmount >= totalAmount && totalAmount > 0) {
        invoiceStatus = 'PAID'
      } else if (paidAmount > 0) {
        invoiceStatus = 'PARTIAL'
      } else if (invoice.sentToClientAt) {
        // Check if overdue (valid until date passed)
        if (invoice.validUntil && new Date(invoice.validUntil) < new Date()) {
          invoiceStatus = 'OVERDUE'
        } else {
          invoiceStatus = 'SENT'
        }
      } else {
        invoiceStatus = 'DRAFT'
      }

      return {
        id: invoice.id,
        invoiceNumber: invoice.quoteNumber,
        title: invoice.title,
        description: invoice.description,
        clientName: invoice.clientName || invoice.project.client?.name || 'Unknown Client',
        clientEmail: invoice.clientEmail || invoice.project.client?.email || '',
        projectName: invoice.project.name,
        itemsCount: invoice.lineItems.length,
        items: invoice.lineItems.map(item => ({
          name: item.displayName,
          quantity: item.quantity,
          total: Number(item.clientTotalPrice)
        })),
        subtotal: Number(invoice.subtotal) || 0,
        gstAmount: Number(invoice.gstAmount) || 0,
        qstAmount: Number(invoice.qstAmount) || 0,
        totalAmount,
        paidAmount,
        balance,
        status: invoiceStatus,
        sentAt: invoice.sentToClientAt,
        sentBy: invoice.sentBy?.name,
        validUntil: invoice.validUntil,
        accessToken: invoice.accessToken,
        payments: invoice.payments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          paidAt: p.paidAt,
          notes: p.notes
        })),
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        // Email tracking
        emailOpenedAt: invoice.emailOpenedAt || (invoice.emailLogs.length > 0 ? invoice.emailLogs[0].openedAt : null),
        viewCount: invoice.emailLogs.length
      }
    })

    // Calculate stats
    const stats = {
      total: formattedInvoices.length,
      draft: formattedInvoices.filter(i => i.status === 'DRAFT').length,
      sent: formattedInvoices.filter(i => i.status === 'SENT').length,
      partial: formattedInvoices.filter(i => i.status === 'PARTIAL').length,
      paid: formattedInvoices.filter(i => i.status === 'PAID').length,
      overdue: formattedInvoices.filter(i => i.status === 'OVERDUE').length,
      totalBilled: formattedInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      totalPaid: formattedInvoices.reduce((sum, i) => sum + i.paidAmount, 0),
      outstanding: formattedInvoices.reduce((sum, i) => sum + i.balance, 0)
    }

    return NextResponse.json({ invoices: formattedInvoices, stats })
  } catch (error) {
    console.error('Error fetching client invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

// POST - Create a new client invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const { id: projectId } = await params
    const body = await request.json()

    const {
      title,
      description,
      lineItems,
      validUntil,
      paymentTerms,
      depositRequired,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      sourceType, // 'specs' | 'approved_quotes'
      sourceIds   // array of spec item IDs or supplier quote IDs
    } = body

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Validate that all items have RRP or trade price
    const invalidItems = lineItems.filter((item: any) => !item.clientUnitPrice || item.clientUnitPrice <= 0)
    if (invalidItems.length > 0) {
      return NextResponse.json({
        error: 'All items must have a valid price (RRP or trade price)',
        invalidItems: invalidItems.map((i: any) => i.displayName)
      }, { status: 400 })
    }

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const lastInvoice = await prisma.clientQuote.findFirst({
      where: {
        orgId,
        quoteNumber: { startsWith: `INV-${currentYear}-` }
      },
      orderBy: { quoteNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastInvoice) {
      const match = lastInvoice.quoteNumber.match(/INV-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const invoiceNumber = `INV-${currentYear}-${String(nextNumber).padStart(4, '0')}`

    // Calculate totals
    const subtotal = lineItems.reduce((sum: number, item: any) =>
      sum + (Number(item.clientTotalPrice) || 0), 0)

    const gstRate = 5.0
    const qstRate = 9.975
    const gstAmount = subtotal * (gstRate / 100)
    const qstAmount = subtotal * (qstRate / 100)
    const totalAmount = subtotal + gstAmount + qstAmount

    // Create the invoice (ClientQuote)
    const invoice = await prisma.clientQuote.create({
      data: {
        orgId,
        projectId,
        quoteNumber: invoiceNumber,
        title,
        description,
        status: 'DRAFT',
        subtotal,
        gstRate,
        gstAmount,
        qstRate,
        qstAmount,
        totalAmount,
        validUntil: validUntil ? new Date(validUntil) : null,
        paymentTerms,
        depositRequired: depositRequired ? depositRequired : null,
        depositAmount: depositRequired ? (totalAmount * depositRequired / 100) : null,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        ccSurchargePercent: 3.0, // Default 3% CC surcharge
        createdById: userId,
        updatedById: userId,
        lineItems: {
          create: lineItems.map((item: any, index: number) => ({
            roomFFEItemId: item.roomFFEItemId,
            supplierQuoteId: item.supplierQuoteId || null,
            displayName: item.displayName,
            displayDescription: item.displayDescription,
            categoryName: item.categoryName,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            unitType: item.unitType || 'units',
            clientUnitPrice: item.clientUnitPrice,
            clientTotalPrice: item.clientTotalPrice,
            supplierUnitPrice: item.supplierUnitPrice || null,
            supplierTotalPrice: item.supplierTotalPrice || null,
            markupType: 'PERCENTAGE',
            markupValue: item.markupValue,
            markupAmount: item.markupAmount,
            order: index
          }))
        }
      },
      include: {
        lineItems: true
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoice.id,
        type: 'CREATED',
        message: `Invoice ${invoiceNumber} created`,
        userId: userId
      }
    })

    // Update spec items status to INVOICED_TO_CLIENT and add activity
    const specItemIds = lineItems
      .filter((item: any) => item.roomFFEItemId)
      .map((item: any) => item.roomFFEItemId)

    if (specItemIds.length > 0) {
      // Update spec items status
      await prisma.roomFFEItem.updateMany({
        where: {
          id: { in: specItemIds }
        },
        data: {
          specStatus: 'INVOICED_TO_CLIENT',
          updatedAt: new Date(),
          updatedById: userId
        }
      })

      // Add activity to each item
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const invoiceLink = `${baseUrl}/client/invoice/${invoice.accessToken}`

      await prisma.itemActivity.createMany({
        data: specItemIds.map((itemId: string) => ({
          itemId,
          type: 'SENT_TO_CLIENT_QUOTE',
          title: 'Invoiced to Client',
          description: `Added to invoice ${invoiceNumber}`,
          actorId: userId,
          actorType: 'user',
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber,
            invoiceLink,
            totalAmount: Number(invoice.totalAmount)
          },
          createdAt: new Date()
        }))
      })
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.quoteNumber,
        totalAmount: Number(invoice.totalAmount),
        itemsCount: invoice.lineItems.length
      }
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
