import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { TimeEntryStatus } from '@prisma/client'

/**
 * GET /api/timeline/entries
 * Fetch time entries with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const userId = searchParams.get('userId') || session.user.id
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status') as TimeEntryStatus | null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))

    // Build where clause
    const where: any = {}

    // Only admins/owners can view other users' entries
    if (userId !== session.user.id && !['OWNER', 'ADMIN'].includes(session.user.role || '')) {
      where.userId = session.user.id
    } else {
      where.userId = userId
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    // Date range filter
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

    const skip = (page - 1) * perPage

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true }
          },
          room: {
            select: { id: true, name: true, type: true }
          },
          stage: {
            select: { id: true, type: true }
          },
          pauses: {
            orderBy: { pausedAt: 'asc' }
          },
          user: {
            select: { id: true, name: true, image: true }
          }
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: perPage
      }),
      prisma.timeEntry.count({ where })
    ])

    // Calculate actual duration for running/paused entries
    const entriesWithDuration = entries.map(entry => {
      let calculatedDuration = entry.duration

      if (entry.status !== 'STOPPED' && entry.startTime) {
        const now = new Date()
        const totalMs = now.getTime() - entry.startTime.getTime()
        
        // Subtract pause time
        const pauseMs = entry.pauses.reduce((acc, pause) => {
          if (pause.resumedAt) {
            return acc + (pause.resumedAt.getTime() - pause.pausedAt.getTime())
          } else if (entry.status === 'PAUSED') {
            // Currently paused
            return acc + (now.getTime() - pause.pausedAt.getTime())
          }
          return acc
        }, 0)

        calculatedDuration = Math.floor((totalMs - pauseMs) / 60000) // Convert to minutes
      }

      return {
        ...entry,
        calculatedDuration,
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
      }
    })

    return NextResponse.json({
      entries: entriesWithDuration,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    })

  } catch (error) {
    console.error('Error fetching time entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/timeline/entries
 * Create a new time entry (start timer or manual entry)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      projectId,
      roomId,
      stageId,
      description,
      startTime,
      endTime,
      isManual = false,
      isBillable = true
    } = body

    // For timer start, check if user already has a running entry
    if (!isManual) {
      const existingRunning = await prisma.timeEntry.findFirst({
        where: {
          userId: session.user.id,
          status: { in: ['RUNNING', 'PAUSED'] }
        }
      })

      if (existingRunning) {
        return NextResponse.json(
          { error: 'You already have an active timer. Please stop it first.' },
          { status: 400 }
        )
      }
    }

    // Create the entry
    const entryData: any = {
      userId: session.user.id,
      projectId: projectId || null,
      roomId: roomId || null,
      stageId: stageId || null,
      description: description || null,
      startTime: startTime ? new Date(startTime) : new Date(),
      isManual,
      isBillable,
      status: isManual ? 'STOPPED' : 'RUNNING'
    }

    // For manual entries, require end time and calculate duration
    if (isManual) {
      if (!endTime) {
        return NextResponse.json(
          { error: 'End time is required for manual entries' },
          { status: 400 }
        )
      }
      entryData.endTime = new Date(endTime)
      entryData.duration = Math.floor(
        (entryData.endTime.getTime() - entryData.startTime.getTime()) / 60000
      )
    }

    const entry = await prisma.timeEntry.create({
      data: entryData,
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: true,
        user: { select: { id: true, name: true, image: true } }
      }
    })

    // Update recent projects in user settings
    if (projectId) {
      await updateRecentProjects(session.user.id, { projectId, roomId, stageId, description })
    }

    return NextResponse.json({
      entry: {
        ...entry,
        startTime: entry.startTime.toISOString(),
        endTime: entry.endTime?.toISOString() || null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating time entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper to update recent projects
async function updateRecentProjects(
  userId: string,
  combo: { projectId?: string; roomId?: string; stageId?: string; description?: string }
) {
  try {
    const settings = await prisma.userTimeSettings.findUnique({
      where: { userId }
    })

    let recentProjects: any[] = []
    if (settings?.recentProjects) {
      recentProjects = settings.recentProjects as any[]
    }

    // Remove existing matching combo
    recentProjects = recentProjects.filter(
      p => !(p.projectId === combo.projectId && p.roomId === combo.roomId && p.stageId === combo.stageId)
    )

    // Add new combo at the start
    recentProjects.unshift({
      projectId: combo.projectId,
      roomId: combo.roomId,
      stageId: combo.stageId,
      description: combo.description,
      usedAt: new Date().toISOString()
    })

    // Keep only last 10
    recentProjects = recentProjects.slice(0, 10)

    await prisma.userTimeSettings.upsert({
      where: { userId },
      create: {
        userId,
        recentProjects
      },
      update: {
        recentProjects
      }
    })
  } catch (error) {
    console.error('Error updating recent projects:', error)
  }
}
