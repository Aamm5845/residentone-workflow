import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const stageId = resolvedParams.id
    const body = await request.json()
    
    const { startDate } = body

    // Check if stage exists and user has access
    const existingStage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                orgId: true
              }
            }
          }
        }
      }
    })

    if (!existingStage) {
      return NextResponse.json(
        { error: 'Stage not found or access denied' },
        { status: 404 }
      )
    }

    // Update the stage's start date
    const updatedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        startDate: startDate ? new Date(startDate) : null,
        updatedAt: new Date(),
        updatedById: session.user.id
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true,
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Log the activity
    try {
      await prisma.activityLog.create({
        data: {
          action: 'STAGE_START_DATE_UPDATED',
          entity: 'STAGE',
          entityId: updatedStage.id,
          details: {
            stageId: updatedStage.id,
            stageType: updatedStage.type,
            roomName: updatedStage.room.name || updatedStage.room.type,
            projectName: updatedStage.room.project.name,
            oldStartDate: existingStage.startDate?.toISOString() || null,
            newStartDate: updatedStage.startDate?.toISOString() || null
          },
          actorId: session.user.id,
          orgId: session.user.orgId
        }
      })
    } catch (activityError) {
      console.warn('Failed to log activity (non-critical):', activityError)
    }

    return NextResponse.json({
      success: true,
      stage: updatedStage
    })

  } catch (error) {
    console.error('Error updating stage start date:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
