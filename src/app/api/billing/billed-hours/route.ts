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

function roundToHalfHour(minutes: number): number {
  return Math.round((minutes / 60) * 2) / 2
}

/**
 * GET /api/billing/billed-hours
 * Fetch billed time entries (not invoice-linked) for a project
 * Query params:
 * - projectId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch billed entries that are NOT linked to an invoice line item
    const entries = await prisma.timeEntry.findMany({
      where: {
        projectId,
        status: 'STOPPED',
        isBillable: true,
        billedStatus: 'BILLED',
        billedInvoiceLineItemId: null,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
      },
      orderBy: { startTime: 'desc' },
    })

    // Calculate summary
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
    const totalHours = roundToHalfHour(totalMinutes)

    const fixedPriceEntries = entries.filter(e => e.billedAmount != null)
    const manualBilledEntries = entries.filter(e => e.billedAmount == null)

    const fixedPriceTotal = fixedPriceEntries.reduce(
      (sum, e) => sum + Number(e.billedAmount || 0), 0
    )

    return NextResponse.json({
      summary: {
        totalHours,
        entryCount: entries.length,
        fixedPriceCount: fixedPriceEntries.length,
        fixedPriceTotal,
        manualBilledCount: manualBilledEntries.length,
      },
      entries: entries.map(e => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        userImage: e.user.image,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString() || null,
        duration: e.duration,
        durationHours: roundToHalfHour(e.duration || 0),
        billedAmount: e.billedAmount != null ? Number(e.billedAmount) : null,
        billedAt: e.billedAt?.toISOString() || null,
        room: e.room ? { id: e.room.id, name: e.room.name, type: e.room.type } : null,
        stage: e.stage ? { id: e.stage.id, type: e.stage.type } : null,
        category: e.billedAmount != null ? 'FIXED_PRICE' : 'MANUAL_BILLED',
      })),
    })
  } catch (error) {
    console.error('Error fetching billed hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/billing/billed-hours
 * Edit or unbill billed time entries
 * Body: { entryIds: string[], action: 'UPDATE_AMOUNT' | 'UNBILL', billedAmount?: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const { entryIds, action, billedAmount } = await request.json()

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'entryIds array is required' }, { status: 400 })
    }

    if (!action || !['UPDATE_AMOUNT', 'UNBILL'].includes(action)) {
      return NextResponse.json({ error: 'action must be UPDATE_AMOUNT or UNBILL' }, { status: 400 })
    }

    // Verify entries exist and are billed (not invoice-linked)
    const entries = await prisma.timeEntry.findMany({
      where: {
        id: { in: entryIds },
        billedStatus: 'BILLED',
        billedInvoiceLineItemId: null,
      },
      select: { id: true, duration: true, projectId: true },
    })

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No eligible billed entries found' }, { status: 404 })
    }

    // Verify project belongs to org
    const projectId = entries[0].projectId
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          orgId: session.user.orgId,
        },
      })
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    if (action === 'UNBILL') {
      const result = await prisma.timeEntry.updateMany({
        where: {
          id: { in: entries.map(e => e.id) },
        },
        data: {
          billedStatus: 'UNBILLED',
          billedAt: null,
          billedAmount: null,
        },
      })

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
        action: 'UNBILL',
      })
    }

    if (action === 'UPDATE_AMOUNT') {
      if (billedAmount == null || typeof billedAmount !== 'number' || billedAmount < 0) {
        return NextResponse.json({ error: 'billedAmount is required for UPDATE_AMOUNT' }, { status: 400 })
      }

      if (entries.length === 1) {
        // Single entry — set amount directly
        await prisma.timeEntry.update({
          where: { id: entries[0].id },
          data: { billedAmount },
        })
      } else {
        // Multiple entries — split proportionally by duration
        const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
        for (const entry of entries) {
          const proportion = totalMinutes > 0
            ? (entry.duration || 0) / totalMinutes
            : 1 / entries.length
          const entryAmount = Math.round(billedAmount * proportion * 100) / 100

          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: { billedAmount: entryAmount },
          })
        }
      }

      return NextResponse.json({
        success: true,
        updatedCount: entries.length,
        action: 'UPDATE_AMOUNT',
        totalAmount: billedAmount,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating billed hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
