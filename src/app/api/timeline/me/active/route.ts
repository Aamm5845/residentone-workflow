import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/me/active
 * Get the current user's active (running or paused) time entry
 * This is used by the timer context to sync state across tabs/devices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['RUNNING', 'PAUSED'] }
      },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true } }
      }
    })

    if (!entry) {
      return NextResponse.json({ entry: null })
    }

    // Calculate elapsed time
    const now = new Date()
    const totalMs = now.getTime() - entry.startTime.getTime()
    
    // Calculate total pause time
    const pauseMs = entry.pauses.reduce((acc, pause) => {
      if (pause.resumedAt) {
        // Completed pause
        return acc + (pause.resumedAt.getTime() - pause.pausedAt.getTime())
      } else if (entry.status === 'PAUSED') {
        // Currently paused - include time up to now
        return acc + (now.getTime() - pause.pausedAt.getTime())
      }
      return acc
    }, 0)

    const elapsedSeconds = Math.floor((totalMs - pauseMs) / 1000)

    return NextResponse.json({
      entry: {
        ...entry,
        startTime: entry.startTime.toISOString(),
        endTime: entry.endTime?.toISOString() || null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        pauses: entry.pauses.map(p => ({
          ...p,
          pausedAt: p.pausedAt.toISOString(),
          resumedAt: p.resumedAt?.toISOString() || null,
          createdAt: p.createdAt.toISOString()
        }))
      },
      elapsedSeconds,
      serverTime: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching active entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
