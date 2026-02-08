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

/**
 * POST /api/billing/mark-billed
 * Mark time entries as already billed (without linking to an invoice)
 * Body: { entryIds: string[], customAmount?: number }
 * customAmount: optional total dollar amount for all selected entries
 * (e.g. 10 hrs marked as billed for $300 total)
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

    const { entryIds, customAmount } = await request.json()

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
        select: { id: true, duration: true },
      })

      const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)

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
          },
        })
        markedCount++
      }

      return NextResponse.json({
        success: true,
        markedCount,
        totalAmount: customAmount,
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
