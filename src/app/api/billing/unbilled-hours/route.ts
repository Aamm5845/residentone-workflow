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
 * GET /api/billing/unbilled-hours
 * Fetch unbilled time entries for a project
 * Query params:
 * - projectId (required)
 * - userId (optional)
 * - startDate (optional)
 * - endDate (optional)
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
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

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

    // Build where clause
    const where: any = {
      projectId,
      status: 'STOPPED',
      isBillable: true,
      billedStatus: 'UNBILLED',
    }

    if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) {
        where.startTime.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.startTime.lte = end
      }
    }

    // Fetch unbilled entries
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, image: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
      },
      orderBy: { startTime: 'desc' },
    })

    // Get hourly rate from proposal
    const proposal = await prisma.proposal.findFirst({
      where: {
        projectId,
        status: 'SIGNED',
      },
      orderBy: { createdAt: 'desc' },
      select: { hourlyRate: true },
    })

    const hourlyRate = proposal?.hourlyRate ? Number(proposal.hourlyRate) : null

    // Round minutes to nearest half-hour
    const roundToHalfHour = (minutes: number) => {
      return Math.round((minutes / 60) * 2) / 2
    }

    // Calculate summary
    const totalUnbilledMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
    const totalUnbilledHours = roundToHalfHour(totalUnbilledMinutes)
    const estimatedAmount = hourlyRate ? totalUnbilledHours * hourlyRate : null

    return NextResponse.json({
      summary: {
        totalUnbilledMinutes,
        totalUnbilledHours,
        entryCount: entries.length,
        hourlyRate,
        estimatedAmount,
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
        room: e.room ? { id: e.room.id, name: e.room.name, type: e.room.type } : null,
        stage: e.stage ? { id: e.stage.id, type: e.stage.type } : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching unbilled hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
