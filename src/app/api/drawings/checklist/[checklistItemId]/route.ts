import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// DELETE /api/drawings/checklist/{checklistItemId}
// Delete a custom checklist item (only CUSTOM type items can be deleted)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { checklistItemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { checklistItemId } = params

    if (!checklistItemId) {
      return NextResponse.json({ 
        error: 'Checklist item ID is required' 
      }, { status: 400 })
    }

    // Verify user has access to this checklist item
    const checklistItem = await prisma.drawingChecklistItem.findUnique({
      where: { id: checklistItemId },
      include: {
        stage: {
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
        },
        assets: true,
        dropboxFiles: true
      }
    })

    if (!checklistItem || checklistItem.stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Checklist item not found or access denied' }, { status: 404 })
    }

    // Only allow deletion of CUSTOM type items
    if (checklistItem.type !== 'CUSTOM') {
      return NextResponse.json({ 
        error: 'Only custom checklist items can be deleted' 
      }, { status: 400 })
    }

    // Prevent deletion if there are files (uploaded or linked)
    if (checklistItem.assets.length > 0 || checklistItem.dropboxFiles.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete checklist item with files. Please remove all files first.' 
      }, { status: 400 })
    }

    // Delete the checklist item
    await prisma.drawingChecklistItem.delete({
      where: { id: checklistItemId }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'DELETE_CUSTOM_CHECKLIST_ITEM',
        entity: 'STAGE',
        entityId: checklistItem.stageId,
        details: {
          checklistItemId,
          checklistItemName: checklistItem.name,
          deletedAt: new Date().toISOString()
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Checklist item deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting checklist item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
