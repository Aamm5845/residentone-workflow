// Single invoice operations - get, update, delete
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get single invoice details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId

    const { id: projectId, invoiceId } = await params

    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                images: true,
                brand: true,
                modelNumber: true,
                finish: true,
                leadTime: true,
                notes: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        createdBy: {
          select: { name: true }
        },
        sentBy: {
          select: { name: true }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Calculate payment totals
    const totalAmount = Number(invoice.totalAmount) || 0
    const paidAmount = invoice.payments
      .filter(p => p.status === 'PAID' || p.status === 'PARTIAL')
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = totalAmount - paidAmount

    return NextResponse.json({
      ...invoice,
      totalAmount,
      paidAmount,
      balance
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

// PATCH - Update invoice
export async function PATCH(
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

    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Only allow updates on draft invoices
    if (invoice.status !== 'DRAFT' && !body.forceUpdate) {
      return NextResponse.json({
        error: 'Cannot edit a sent invoice. Create a new version instead.'
      }, { status: 400 })
    }

    const updated = await prisma.clientQuote.update({
      where: { id: invoiceId },
      data: {
        title: body.title ?? invoice.title,
        description: body.description ?? invoice.description,
        validUntil: body.validUntil ? new Date(body.validUntil) : invoice.validUntil,
        paymentTerms: body.paymentTerms ?? invoice.paymentTerms,
        clientName: body.clientName ?? invoice.clientName,
        clientEmail: body.clientEmail ?? invoice.clientEmail,
        clientPhone: body.clientPhone ?? invoice.clientPhone,
        clientAddress: body.clientAddress ?? invoice.clientAddress,
        updatedById: userId,
        updatedAt: new Date()
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoiceId,
        type: 'UPDATED',
        message: 'Invoice details updated',
        userId: userId
      }
    })

    return NextResponse.json({ success: true, invoice: updated })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

// DELETE - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId

    const { id: projectId, invoiceId } = await params

    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        payments: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Prevent deletion of invoices with payment records
    if (invoice.payments.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete an invoice with payment records'
      }, { status: 400 })
    }

    // Delete related records first
    await prisma.clientQuoteLineItem.deleteMany({
      where: { clientQuoteId: invoiceId }
    })
    await prisma.clientQuoteActivity.deleteMany({
      where: { clientQuoteId: invoiceId }
    })
    await prisma.clientQuoteEmailLog.deleteMany({
      where: { clientQuoteId: invoiceId }
    })

    await prisma.clientQuote.delete({
      where: { id: invoiceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
