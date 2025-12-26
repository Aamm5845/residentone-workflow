import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// Helper function to safely serialize Prisma results with dates
function sanitizeForJson(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value)
      }
      return value
    })
  )
}

// PATCH /api/drawings/{stageId}/checklist
// Toggle checklist item completion status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { checklistItemId, completed } = body

    console.log('[DRAWINGS-CHECKLIST-PATCH] Request:', { stageId, checklistItemId, completed })

    if (!stageId || !checklistItemId || typeof completed !== 'boolean') {
      console.error('[DRAWINGS-CHECKLIST-PATCH] Invalid payload:', { stageId, checklistItemId, completed })
      return NextResponse.json({ 
        error: 'Stage ID, checklist item ID, and completed status are required' 
      }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          include: {
            project: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    })

    if (!stage || stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Stage not found or access denied' }, { status: 404 })
    }

    // Ensure this is a DRAWINGS stage
    if (stage.type !== 'DRAWINGS') {
      return NextResponse.json({ error: 'Invalid stage type for drawings workspace' }, { status: 400 })
    }

    // Verify checklist item belongs to this stage
    const checklistItem = await prisma.drawingChecklistItem.findUnique({
      where: { id: checklistItemId }
    })

    if (!checklistItem || checklistItem.stageId !== stageId) {
      return NextResponse.json({ error: 'Invalid checklist item' }, { status: 400 })
    }

    // Update checklist item
    const updatedItem = await prisma.drawingChecklistItem.update({
      where: { id: checklistItemId },
      data: { 
        completed,
        completedAt: completed ? new Date() : null
      },
      include: {
        assets: {
          include: {
            uploadedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        dropboxFiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    console.log('[DRAWINGS-CHECKLIST-PATCH] Successfully updated item:', checklistItemId)

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'TOGGLE_CHECKLIST_ITEM',
        entity: 'STAGE',
        entityId: stageId,
        details: {
          checklistItemId,
          checklistItemName: checklistItem.name,
          completed,
          action: completed ? 'marked_complete' : 'marked_incomplete'
        },
        orgId: session.user.orgId
      }
    })

    // Sanitize the response to avoid serialization issues
    const sanitized = sanitizeForJson(updatedItem)

    return NextResponse.json({
      success: true,
      checklistItem: sanitized
    })

  } catch (error) {
    console.error('[DRAWINGS-CHECKLIST-PATCH] Error updating checklist item:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
