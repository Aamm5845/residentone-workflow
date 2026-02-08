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
 * Body: { entryIds: string[] }
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

    const { entryIds } = await request.json()

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'entryIds array is required' }, { status: 400 })
    }

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
