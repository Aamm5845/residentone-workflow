import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { dueDateSchema, validatePhaseDueDates } from '@/lib/validation/due-date-validation'

// Using imported dueDateSchema which includes past date validation

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
    
    // Validate request body
    
    const validationResult = dueDateSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Due date validation failed:', validationResult.error.issues)
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { dueDate } = validationResult.data

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

    // Get all stages for the room to validate phase ordering
    if (dueDate) {
      const roomStages = await prisma.stage.findMany({
        where: {
          roomId: existingStage.roomId
        },
        select: {
          id: true,
          type: true,
          dueDate: true
        }
      })

      // Create array with updated due date
      const phasesForValidation = roomStages.map(stage => ({
        type: stage.type,
        dueDate: stage.id === stageId ? new Date(dueDate) : stage.dueDate
      }))

      // Validate phase ordering
      const validation = validatePhaseDueDates(phasesForValidation)
      if (!validation.isValid) {
        console.warn('Phase ordering validation failed:', validation.errors)
        return NextResponse.json(
          { 
            error: 'Invalid phase ordering', 
            details: validation.errors 
          },
          { status: 400 }
        )
      }
    }

    // Update the stage's due date
    console.log('Updating stage due date:', {
      stageId,
      dueDate,
      parsedDate: dueDate ? new Date(dueDate) : null,
      userId: session.user.id
    })
    
    const updatedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        dueDate: dueDate ? new Date(dueDate) : null,
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

    // Log the activity (temporarily disabled for debugging)
    try {
      await prisma.activityLog.create({
        data: {
          action: 'STAGE_DUE_DATE_UPDATED',
          details: {
            stageId: updatedStage.id,
            stageType: updatedStage.type,
            roomName: updatedStage.room.name || updatedStage.room.type,
            projectName: updatedStage.room.project.name,
            oldDueDate: existingStage.dueDate?.toISOString() || null,
            newDueDate: updatedStage.dueDate?.toISOString() || null
          },
          userId: session.user.id,
          orgId: session.user.orgId,
          projectId: updatedStage.room.project.id,
          roomId: updatedStage.room.id,
          stageId: updatedStage.id
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
    console.error('Error updating stage due date:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}