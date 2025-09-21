import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// Mark Design Concept stage as complete and trigger notifications
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { stageId } = data

    if (!stageId) {
      return NextResponse.json({ 
        error: 'Missing required field: stageId' 
      }, { status: 400 })
    }

    // Find the Design Concept stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        type: 'DESIGN_CONCEPT'
      },
      include: {
        room: {
          include: {
            project: true,
            stages: {
              where: {
                type: 'THREE_D'
              },
              include: {
                assignedUser: true
              }
            }
          }
        },
        designSections: {
          include: {
            checklistItems: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ 
        error: 'Design Concept stage not found or access denied' 
      }, { status: 404 })
    }

    if (stage.status === 'COMPLETED') {
      return NextResponse.json({
        error: 'Stage is already completed'
      }, { status: 400 })
    }

    // Validate that all required sections exist and can be marked complete
    const requiredSections = ['GENERAL', 'WALL_COVERING', 'CEILING', 'FLOOR']
    const existingSections = stage.designSections.map(s => s.type)
    const missingSections = requiredSections.filter(req => !existingSections.includes(req))

    if (missingSections.length > 0) {
      return NextResponse.json({
        error: `Cannot complete stage. Missing sections: ${missingSections.join(', ')}`
      }, { status: 400 })
    }

    // Optional: Check if all sections have some content (can be skipped for flexibility)
    // const incompleteSections = stage.designSections.filter(section => 
    //   !section.content || section.content.trim().length === 0
    // )
    // if (incompleteSections.length > 0) {
    //   return NextResponse.json({
    //     error: `Some sections are empty. Please add content before completing.`
    //   }, { status: 400 })
    // }

    // Mark all sections as complete if they aren't already
    const sectionsToUpdate = stage.designSections.filter(section => !section.completed)
    
    for (const section of sectionsToUpdate) {
      await prisma.designSection.update({
        where: { id: section.id },
        data: withCompletionAttribution(session, {
          completed: true
        })
      })
    }

    // Mark the stage as completed
    const completedStage = await prisma.stage.update({
      where: { id: stageId },
      data: withCompletionAttribution(session, {
        status: 'COMPLETED',
        completedAt: new Date()
      })
    })

    // Log the completion activity
    await logActivity({
      session,
      action: ActivityActions.STAGE_COMPLETED,
      entity: EntityTypes.STAGE,
      entityId: stageId,
      details: {
        stageType: 'DESIGN_CONCEPT',
        stageName: `Design Concept - ${stage.room.name || stage.room.type}`,
        projectName: stage.room.project.name,
        roomId: stage.room.id,
        projectId: stage.room.project.id,
        sectionsCompleted: sectionsToUpdate.length,
        totalSections: stage.designSections.length
      },
      ipAddress
    })

    // Find the next stage (3D Rendering) and assigned user
    const threeDStage = stage.room.stages.find(s => s.type === 'THREE_D')
    
    if (threeDStage && threeDStage.assignedUser) {
      // Create notification for 3D Rendering team member
      await prisma.notification.create({
        data: {
          userId: threeDStage.assignedUser.id,
          type: 'STAGE_ASSIGNED',
          title: 'Design Concept Ready for 3D Rendering',
          message: `The Design Concept phase for ${stage.room.name || stage.room.type} in "${stage.room.project.name}" has been completed and is ready for 3D rendering.`,
          relatedId: threeDStage.id,
          relatedType: 'STAGE'
        }
      })

      // Log the notification activity
      await logActivity({
        session,
        action: ActivityActions.NOTIFICATION_CREATED,
        entity: EntityTypes.NOTIFICATION,
        entityId: '', // We don't have the notification ID here
        details: {
          notificationType: 'STAGE_ASSIGNED',
          recipientId: threeDStage.assignedUser.id,
          recipientName: threeDStage.assignedUser.name,
          relatedStageId: threeDStage.id,
          relatedStageType: 'THREE_D',
          projectName: stage.room.project.name,
          roomName: stage.room.name || stage.room.type
        },
        ipAddress
      })
    }

    // Update the next stage status if it's not started
    if (threeDStage && threeDStage.status === 'NOT_STARTED') {
      await prisma.stage.update({
        where: { id: threeDStage.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          updatedById: session.user.id,
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Design Concept stage completed successfully',
      stage: {
        id: completedStage.id,
        status: completedStage.status,
        completedAt: completedStage.completedAt,
        completedById: completedStage.completedById
      },
      nextStage: threeDStage ? {
        id: threeDStage.id,
        type: threeDStage.type,
        assignedUser: threeDStage.assignedUser ? {
          id: threeDStage.assignedUser.id,
          name: threeDStage.assignedUser.name
        } : null,
        notificationSent: !!threeDStage.assignedUser
      } : null
    })

  } catch (error) {
    console.error('Error completing Design Concept stage:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get completion status and requirements for a Design Concept stage
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const stageId = url.searchParams.get('stageId')

    if (!stageId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: stageId' 
      }, { status: 400 })
    }

    // Find the Design Concept stage and analyze completion status
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        type: 'DESIGN_CONCEPT'
      },
      include: {
        room: {
          include: {
            project: true
          }
        },
        designSections: {
          include: {
            checklistItems: true,
            assets: {
              select: {
                id: true,
                title: true,
                type: true
              }
            },
            comments: {
              select: {
                id: true
              }
            }
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ 
        error: 'Design Concept stage not found' 
      }, { status: 404 })
    }

    // Analyze completion requirements
    const requiredSections = ['GENERAL', 'WALL_COVERING', 'CEILING', 'FLOOR']
    const existingSections = stage.designSections.map(s => s.type)
    const missingSections = requiredSections.filter(req => !existingSections.includes(req))

    // Calculate section completion stats
    const sectionStats = stage.designSections.map(section => {
      const totalChecklistItems = section.checklistItems.length
      const completedChecklistItems = section.checklistItems.filter(item => item.completed).length
      const checklistCompletion = totalChecklistItems > 0 ? (completedChecklistItems / totalChecklistItems) * 100 : 100

      return {
        id: section.id,
        type: section.type,
        completed: section.completed,
        hasContent: !!section.content && section.content.trim().length > 0,
        assetCount: section.assets.length,
        commentCount: section.comments.length,
        checklistItems: {
          total: totalChecklistItems,
          completed: completedChecklistItems,
          percentage: Math.round(checklistCompletion)
        }
      }
    })

    // Overall completion analysis
    const totalSections = requiredSections.length
    const completedSections = sectionStats.filter(s => s.completed).length
    const sectionsWithContent = sectionStats.filter(s => s.hasContent).length
    const sectionsWithAssets = sectionStats.filter(s => s.assetCount > 0).length

    const overallCompletion = Math.round((completedSections / totalSections) * 100)
    const canComplete = missingSections.length === 0 && stage.status !== 'COMPLETED'

    return NextResponse.json({
      success: true,
      stage: {
        id: stage.id,
        status: stage.status,
        completedAt: stage.completedAt,
        canComplete: canComplete
      },
      completion: {
        percentage: overallCompletion,
        completedSections: completedSections,
        totalSections: totalSections,
        sectionsWithContent: sectionsWithContent,
        sectionsWithAssets: sectionsWithAssets
      },
      requirements: {
        missingSections: missingSections,
        allSectionsExist: missingSections.length === 0,
        readyForCompletion: canComplete
      },
      sections: sectionStats
    })

  } catch (error) {
    console.error('Error getting completion status:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
