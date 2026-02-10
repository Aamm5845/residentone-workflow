import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

async function generateInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const lastInvoice = await prisma.billingInvoice.findFirst({
    where: {
      orgId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })

  let nextNumber = 1
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`
}

function roundToHalfHour(minutes: number): number {
  return Math.round((minutes / 60) * 2) / 2
}

/**
 * POST /api/billing/mark-billed
 * Mark time entries as already billed (without linking to an invoice)
 * Body: { entryIds: string[], customAmount?: number, createInvoiceLineItem?: boolean }
 * customAmount: optional total dollar amount for all selected entries
 * createInvoiceLineItem: when true + customAmount > 0, adds a FIXED line item to the most recent DRAFT invoice
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const { entryIds, customAmount, createInvoiceLineItem } = await request.json()

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'entryIds array is required' }, { status: 400 })
    }

    // If customAmount provided, split it proportionally across entries by duration
    if (customAmount != null && typeof customAmount === 'number' && customAmount > 0) {
      // Get entries to calculate proportional amounts
      const entries = await prisma.timeEntry.findMany({
        where: {
          id: { in: entryIds },
          billedStatus: 'UNBILLED',
          status: 'STOPPED',
          isBillable: true,
        },
        select: { id: true, duration: true, projectId: true, stage: { select: { type: true } } },
      })

      const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
      const totalHours = roundToHalfHour(totalMinutes)

      // If createInvoiceLineItem is true, find/create a draft invoice and add the line item
      let invoiceLineItemId: string | null = null
      let invoiceId: string | null = null
      if (createInvoiceLineItem && customAmount > 0) {
        const projectId = entries[0]?.projectId
        if (projectId) {
          // Find the most recent DRAFT invoice for this project
          let draftInvoice = await prisma.billingInvoice.findFirst({
            where: {
              projectId,
              orgId: session.user.orgId,
              status: 'DRAFT',
            },
            orderBy: { createdAt: 'desc' },
            include: { lineItems: true },
          })

          if (!draftInvoice) {
            // Create a new draft invoice
            const project = await prisma.project.findFirst({
              where: { id: projectId, orgId: session.user.orgId },
              include: { client: true },
            })

            if (project && project.client) {
              const invoiceNumber = await generateInvoiceNumber(session.user.orgId)
              draftInvoice = await prisma.billingInvoice.create({
                data: {
                  orgId: session.user.orgId,
                  projectId,
                  invoiceNumber,
                  title: `${project.name} - Billed Hours`,
                  type: 'STANDARD',
                  status: 'DRAFT',
                  clientName: project.client.name,
                  clientEmail: project.client.email,
                  subtotal: customAmount,
                  totalAmount: customAmount,
                  amountPaid: 0,
                  balanceDue: customAmount,
                  createdById: session.user.id,
                },
                include: { lineItems: true },
              })
            }
          }

          if (draftInvoice) {
            invoiceId = draftInvoice.id

            // Build a description from phase/hours
            const phases = [...new Set(entries.map(e => e.stage?.type).filter(Boolean))]
            const phaseLabel = phases.length > 0 ? phases.join(', ') : 'General'
            const description = `${phaseLabel} - ${totalHours} hrs (${entries.length} entries)`

            const nextOrder = draftInvoice.lineItems.length

            // Add line item
            const lineItem = await prisma.billingInvoiceLineItem.create({
              data: {
                billingInvoiceId: draftInvoice.id,
                type: 'FIXED',
                description,
                quantity: 1,
                unitPrice: customAmount,
                amount: customAmount,
                hours: totalHours,
                timeEntryIds: entries.map(e => e.id),
                order: nextOrder,
              },
            })
            invoiceLineItemId = lineItem.id

            // Recalculate invoice totals
            const allLineItems = await prisma.billingInvoiceLineItem.findMany({
              where: { billingInvoiceId: draftInvoice.id },
            })
            const newSubtotal = allLineItems.reduce((sum, li) => sum + Number(li.amount), 0)
            const gstAmount = draftInvoice.gstRate ? newSubtotal * (Number(draftInvoice.gstRate) / 100) : 0
            const qstAmount = draftInvoice.qstRate ? newSubtotal * (Number(draftInvoice.qstRate) / 100) : 0
            const newTotal = newSubtotal + gstAmount + qstAmount

            await prisma.billingInvoice.update({
              where: { id: draftInvoice.id },
              data: {
                subtotal: newSubtotal,
                gstAmount: gstAmount || undefined,
                qstAmount: qstAmount || undefined,
                totalAmount: newTotal,
                balanceDue: newTotal - Number(draftInvoice.amountPaid),
              },
            })
          }
        }
      }

      // Update each entry with its proportional share of the custom amount
      let markedCount = 0
      for (const entry of entries) {
        const proportion = totalMinutes > 0 ? (entry.duration || 0) / totalMinutes : 1 / entries.length
        const entryAmount = Math.round(customAmount * proportion * 100) / 100

        await prisma.timeEntry.update({
          where: { id: entry.id },
          data: {
            billedStatus: 'BILLED',
            billedAt: new Date(),
            billedAmount: entryAmount,
            billedInvoiceLineItemId: invoiceLineItemId || undefined,
          },
        })
        markedCount++
      }

      return NextResponse.json({
        success: true,
        markedCount,
        totalAmount: customAmount,
        invoiceLineItemId,
        invoiceId,
      })
    }

    // No custom amount - just mark as billed
    const result = await prisma.timeEntry.updateMany({
      where: {
        id: { in: entryIds },
        billedStatus: 'UNBILLED',
        status: 'STOPPED',
        isBillable: true,
      },
      data: {
        billedStatus: 'BILLED',
        billedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      markedCount: result.count,
    })
  } catch (error) {
    console.error('Error marking entries as billed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
