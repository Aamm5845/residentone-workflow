import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/team/active
 * Get all team members' active (running or paused) time entries
 * Used for the "Team Activity" view
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all team members in the organization
    const teamMembers = await prisma.user.findMany({
      where: {
        orgId: session.user.orgId,
        approvalStatus: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true
      },
      orderBy: { name: 'asc' }
    })

    // Get all active entries for team members
    const activeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: { in: teamMembers.map(m => m.id) },
        status: { in: ['RUNNING', 'PAUSED'] }
      },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true, role: true } }
      }
    })

    const now = new Date()

    // Map entries by userId for quick lookup
    const entriesByUser = new Map(
      activeEntries.map(entry => {
        // Calculate elapsed time
        const totalMs = now.getTime() - entry.startTime.getTime()
        
        const pauseMs = entry.pauses.reduce((acc, pause) => {
          if (pause.resumedAt) {
            return acc + (pause.resumedAt.getTime() - pause.pausedAt.getTime())
          } else if (entry.status === 'PAUSED') {
            return acc + (now.getTime() - pause.pausedAt.getTime())
          }
          return acc
        }, 0)

        const elapsedSeconds = Math.floor((totalMs - pauseMs) / 1000)

        return [
          entry.userId,
          {
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime?.toISOString() || null,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
            elapsedSeconds,
            pauses: entry.pauses.map(p => ({
              ...p,
              pausedAt: p.pausedAt.toISOString(),
              resumedAt: p.resumedAt?.toISOString() || null,
              createdAt: p.createdAt.toISOString()
            }))
          }
        ]
      })
    )

    // Build response with all team members
    const teamActivity = teamMembers.map(member => ({
      user: member,
      activeEntry: entriesByUser.get(member.id) || null,
      isTracking: entriesByUser.has(member.id),
      isPaused: entriesByUser.get(member.id)?.status === 'PAUSED'
    }))

    return NextResponse.json({
      team: teamActivity,
      serverTime: now.toISOString(),
      activeCount: activeEntries.length
    })

  } catch (error) {
    console.error('Error fetching team activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
