import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/entries/[id]
 * Get a single time entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true } },
        edits: {
          include: {
            editedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Check permission
    if (entry.userId !== session.user.id && !['OWNER', 'ADMIN'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ entry })

  } catch (error) {
    console.error('Error fetching time entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/timeline/entries/[id]
 * Update a time entry (description, project, times, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, ...updates } = body

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: { pauses: true }
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Check permission - users can only edit their own entries
    if (entry.userId !== session.user.id && !['OWNER', 'ADMIN'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Handle special actions
    if (action === 'pause') {
      return handlePause(entry, session.user.id)
    }

    if (action === 'resume') {
      return handleResume(entry, session.user.id)
    }

    if (action === 'stop') {
      return handleStop(entry, session.user.id, updates.endTime)
    }

    // Regular update
    const updateData: any = {}
    const edits: any[] = []

    // Track changes for audit
    if (updates.description !== undefined && updates.description !== entry.description) {
      edits.push({
        field: 'description',
        previousValue: entry.description,
        newValue: updates.description
      })
      updateData.description = updates.description
    }

    if (updates.projectId !== undefined && updates.projectId !== entry.projectId) {
      edits.push({
        field: 'projectId',
        previousValue: entry.projectId,
        newValue: updates.projectId
      })
      updateData.projectId = updates.projectId || null
    }

    if (updates.roomId !== undefined && updates.roomId !== entry.roomId) {
      edits.push({
        field: 'roomId',
        previousValue: entry.roomId,
        newValue: updates.roomId
      })
      updateData.roomId = updates.roomId || null
    }

    if (updates.stageId !== undefined && updates.stageId !== entry.stageId) {
      edits.push({
        field: 'stageId',
        previousValue: entry.stageId,
        newValue: updates.stageId
      })
      updateData.stageId = updates.stageId || null
    }

    if (updates.startTime && new Date(updates.startTime).getTime() !== entry.startTime.getTime()) {
      edits.push({
        field: 'startTime',
        previousValue: entry.startTime.toISOString(),
        newValue: updates.startTime
      })
      updateData.startTime = new Date(updates.startTime)
    }

    if (updates.endTime !== undefined) {
      const prevEndTime = entry.endTime?.toISOString() || null
      if (updates.endTime !== prevEndTime) {
        edits.push({
          field: 'endTime',
          previousValue: prevEndTime,
          newValue: updates.endTime
        })
        updateData.endTime = updates.endTime ? new Date(updates.endTime) : null
      }
    }

    if (updates.isBillable !== undefined && updates.isBillable !== entry.isBillable) {
      edits.push({
        field: 'isBillable',
        previousValue: String(entry.isBillable),
        newValue: String(updates.isBillable)
      })
      updateData.isBillable = updates.isBillable
    }

    // Recalculate duration if times changed and entry is stopped
    if (entry.status === 'STOPPED' && (updateData.startTime || updateData.endTime)) {
      const start = updateData.startTime || entry.startTime
      const end = updateData.endTime || entry.endTime
      if (end) {
        const totalMs = end.getTime() - start.getTime()
        const pauseMs = entry.pauses.reduce((acc, p) => {
          if (p.resumedAt) {
            return acc + (p.resumedAt.getTime() - p.pausedAt.getTime())
          }
          return acc
        }, 0)
        updateData.duration = Math.floor((totalMs - pauseMs) / 60000)
      }
    }

    // Apply updates
    const updated = await prisma.$transaction(async (tx) => {
      // Create audit records
      if (edits.length > 0) {
        await tx.timeEntryEdit.createMany({
          data: edits.map(edit => ({
            timeEntryId: id,
            editedById: session.user.id,
            field: edit.field,
            previousValue: edit.previousValue,
            newValue: edit.newValue,
            reason: updates.reason || null
          }))
        })
      }

      // Update entry
      return tx.timeEntry.update({
        where: { id },
        data: updateData,
        include: {
          project: { select: { id: true, name: true } },
          room: { select: { id: true, name: true, type: true } },
          stage: { select: { id: true, type: true } },
          pauses: { orderBy: { pausedAt: 'asc' } },
          user: { select: { id: true, name: true, image: true } }
        }
      })
    })

    return NextResponse.json({
      entry: {
        ...updated,
        startTime: updated.startTime.toISOString(),
        endTime: updated.endTime?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating time entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/timeline/entries/[id]
 * Delete a time entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const entry = await prisma.timeEntry.findUnique({
      where: { id }
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Check permission
    if (entry.userId !== session.user.id && !['OWNER', 'ADMIN'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.timeEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting time entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle pause action
async function handlePause(entry: any, userId: string) {
  if (entry.status !== 'RUNNING') {
    return NextResponse.json(
      { error: 'Only running entries can be paused' },
      { status: 400 }
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Create pause record
    await tx.timePause.create({
      data: {
        timeEntryId: entry.id,
        pausedAt: new Date()
      }
    })

    // Update entry status
    return tx.timeEntry.update({
      where: { id: entry.id },
      data: { status: 'PAUSED' },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true } }
      }
    })
  })

  return NextResponse.json({
    entry: {
      ...updated,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    }
  })
}

// Handle resume action
async function handleResume(entry: any, userId: string) {
  if (entry.status !== 'PAUSED') {
    return NextResponse.json(
      { error: 'Only paused entries can be resumed' },
      { status: 400 }
    )
  }

  // Find the active (unended) pause
  const activePause = entry.pauses.find((p: any) => !p.resumedAt)
  if (!activePause) {
    return NextResponse.json(
      { error: 'No active pause found' },
      { status: 400 }
    )
  }

  const now = new Date()
  const pauseDuration = Math.floor((now.getTime() - activePause.pausedAt.getTime()) / 60000)

  const updated = await prisma.$transaction(async (tx) => {
    // Update pause record
    await tx.timePause.update({
      where: { id: activePause.id },
      data: {
        resumedAt: now,
        duration: pauseDuration
      }
    })

    // Update entry status
    return tx.timeEntry.update({
      where: { id: entry.id },
      data: { status: 'RUNNING' },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true } }
      }
    })
  })

  return NextResponse.json({
    entry: {
      ...updated,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    }
  })
}

// Handle stop action
async function handleStop(entry: any, userId: string, customEndTime?: string) {
  if (entry.status === 'STOPPED') {
    return NextResponse.json(
      { error: 'Entry is already stopped' },
      { status: 400 }
    )
  }

  const endTime = customEndTime ? new Date(customEndTime) : new Date()

  // If paused, close the active pause first
  const activePause = entry.pauses.find((p: any) => !p.resumedAt)

  const updated = await prisma.$transaction(async (tx) => {
    // Close active pause if exists
    if (activePause) {
      const pauseDuration = Math.floor((endTime.getTime() - activePause.pausedAt.getTime()) / 60000)
      await tx.timePause.update({
        where: { id: activePause.id },
        data: {
          resumedAt: endTime,
          duration: pauseDuration
        }
      })
    }

    // Get all pauses to calculate total pause time
    const allPauses = await tx.timePause.findMany({
      where: { timeEntryId: entry.id }
    })

    // Calculate total duration (end - start - pauses)
    const totalMs = endTime.getTime() - entry.startTime.getTime()
    const pauseMs = allPauses.reduce((acc, p) => {
      const pEnd = p.resumedAt || endTime
      return acc + (pEnd.getTime() - p.pausedAt.getTime())
    }, 0)
    const duration = Math.floor((totalMs - pauseMs) / 60000)

    // Update entry
    return tx.timeEntry.update({
      where: { id: entry.id },
      data: {
        status: 'STOPPED',
        endTime,
        duration
      },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        pauses: { orderBy: { pausedAt: 'asc' } },
        user: { select: { id: true, name: true, image: true } }
      }
    })
  })

  return NextResponse.json({
    entry: {
      ...updated,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    }
  })
}
