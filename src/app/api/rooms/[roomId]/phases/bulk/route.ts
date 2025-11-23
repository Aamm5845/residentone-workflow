import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'
import { autoUpdateProjectStatus } from '@/lib/utils/project-status-updater'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { phaseUpdates } = data // Array of { stageType: string, status: 'NOT_APPLICABLE' | 'NOT_STARTED' }
    
    // Verify room access
    const room = await prisma.room.findFirst({
      where: {
        id: resolvedParams.roomId
      },
      include: {
        project: {
          select: {
            id: true
          }
        },
        stages: {
          select: {
            id: true,
            type: true,
            status: true
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    const results = []
    
    for (const update of phaseUpdates) {
      const stage = room.stages.find(s => s.type === update.stageType)
      
      if (!stage) {
        console.warn(`Stage ${update.stageType} not found in room ${resolvedParams.roomId}`)
        continue
      }
      
      let updateData: any = {}
      let activityAction: string = ActivityActions.STAGE_STATUS_CHANGED
      
      if (update.status === 'NOT_APPLICABLE') {
        updateData = withUpdateAttribution(session, {
          status: 'NOT_APPLICABLE',
          assignedTo: null, // Clear assignment when marking as not applicable
          startedAt: null,
          completedAt: null,
          completedById: null
        })
        activityAction = 'STAGE_MARKED_NOT_APPLICABLE'
      } else if (update.status === 'NOT_STARTED') {
        updateData = withUpdateAttribution(session, {
          status: 'NOT_STARTED'
        })
        activityAction = 'STAGE_MARKED_APPLICABLE'
      }
      
      const updatedStage = await prisma.stage.update({
        where: { id: stage.id },
        data: updateData
      })
      
      // Log the activity
      await logActivity({
        session,
        action: activityAction,
        entity: EntityTypes.STAGE,
        entityId: stage.id,
        details: {
          stageName: `${stage.type} - ${room.name || room.type}`,
          previousStatus: stage.status,
          newStatus: update.status
        },
        ipAddress
      })
      
      results.push({
        stageType: stage.type,
        stageId: stage.id,
        previousStatus: stage.status,
        newStatus: update.status,
        success: true
      })
    }
    
    // Auto-update project status after bulk updates
    if (room.project?.id) {
      await autoUpdateProjectStatus(room.project.id)
    }
    
    return NextResponse.json({
      success: true,
      results,
      message: `Updated ${results.length} phase(s)`
    })
  } catch (error) {
    console.error('Error updating phases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}