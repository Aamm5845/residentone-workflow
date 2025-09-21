import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { WORKFLOW_STAGES } from '@/constants/workflow'

// POST /api/drawings/{stageId}/complete
// Mark drawings stage as complete and trigger notifications
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = params

    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify user has access to this stage and get related data
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          include: {
            project: {
              include: {
                organization: true,
                client: true
              }
            },
            stages: {
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        assignedUser: true,
        drawingChecklist: {
          include: {
            assets: true
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

    // Validate all checklist items are complete
    const incompleteItems = stage.drawingChecklist.filter(item => !item.completed)
    if (incompleteItems.length > 0) {
      return NextResponse.json({ 
        error: `Cannot complete stage: ${incompleteItems.length} checklist item(s) not completed`,
        incompleteItems: incompleteItems.map(item => item.name)
      }, { status: 400 })
    }

    // Validate at least one file per checklist item
    const itemsWithoutFiles = stage.drawingChecklist.filter(item => item.assets.length === 0)
    if (itemsWithoutFiles.length > 0) {
      return NextResponse.json({ 
        error: `Cannot complete stage: ${itemsWithoutFiles.length} checklist item(s) have no files uploaded`,
        itemsWithoutFiles: itemsWithoutFiles.map(item => item.name)
      }, { status: 400 })
    }

    // Update stage to completed
    const completedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: session.user.id
      }
    })

    // Log completion activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'COMPLETE_DRAWINGS_STAGE',
        entity: 'STAGE',
        entityId: stageId,
        details: {
          completedItems: stage.drawingChecklist.length,
          totalFiles: stage.drawingChecklist.reduce((sum, item) => sum + item.assets.length, 0),
          completedAt: new Date().toISOString()
        },
        orgId: session.user.orgId
      }
    })

    // Find next stage in workflow
    const currentStageIndex = WORKFLOW_STAGES.indexOf('DRAWINGS')
    const nextStageType = WORKFLOW_STAGES[currentStageIndex + 1]
    
    if (nextStageType) {
      // Find or create next stage
      let nextStage = stage.room.stages.find(s => s.type === nextStageType)
      
      if (!nextStage) {
        // Create next stage
        nextStage = await prisma.stage.create({
          data: {
            roomId: stage.roomId,
            type: nextStageType,
            status: 'NOT_STARTED',
            createdById: session.user.id
          }
        })
      }

      // Assign next stage based on workflow rules
      let assignedUserId = null
      if (nextStageType === 'FFE') {
        // Find user with FFE role
        const ffeUser = await prisma.user.findFirst({
          where: {
            orgId: session.user.orgId,
            role: 'FFE'
          }
        })
        assignedUserId = ffeUser?.id
      }

      if (assignedUserId && nextStage.assignedTo !== assignedUserId) {
        await prisma.stage.update({
          where: { id: nextStage.id },
          data: { assignedTo: assignedUserId }
        })
      }

      // Create notification for next assigned user
      if (assignedUserId) {
        await prisma.notification.create({
          data: {
            userId: assignedUserId,
            type: 'STAGE_ASSIGNED',
            title: 'New Stage Assigned',
            message: `Drawings stage completed for ${stage.room.name || stage.room.type}. ${nextStageType} stage is now ready.`,
            relatedId: nextStage.id,
            relatedType: 'STAGE'
          }
        })
      }
    }

    // Update room progress
    const allStages = await prisma.stage.findMany({
      where: { roomId: stage.roomId }
    })
    const completedStagesCount = allStages.filter(s => s.status === 'COMPLETED').length
    const progressPercentage = Math.round((completedStagesCount / allStages.length) * 100)

    await prisma.room.update({
      where: { id: stage.roomId },
      data: {
        status: progressPercentage === 100 ? 'COMPLETED' : 'IN_PROGRESS'
      }
    })

    return NextResponse.json({
      success: true,
      stage: completedStage,
      nextStage: nextStageType,
      message: 'Drawings stage completed successfully'
    })

  } catch (error) {
    console.error('Error completing drawings stage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}