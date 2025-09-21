import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution, 
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { action, assignedTo, dueDate } = data
    
    // Verify stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }
    
    // Update stage based on action
    let updateData: any = {}
    let activityAction: string = ActivityActions.STAGE_STATUS_CHANGED
    
    if (action === 'start') {
      updateData = withUpdateAttribution(session, {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        ...(assignedTo && { assignedTo })
      })
      activityAction = ActivityActions.STAGE_STARTED
    } else if (action === 'complete') {
      updateData = withCompletionAttribution(session, {
        status: 'COMPLETED'
      })
      activityAction = ActivityActions.STAGE_COMPLETED
    } else if (action === 'pause') {
      updateData = withUpdateAttribution(session, {
        status: 'ON_HOLD'
      })
    } else if (action === 'reopen') {
      updateData = withUpdateAttribution(session, {
        status: 'IN_PROGRESS',
        completedAt: null,
        startedAt: new Date(),
        completedById: null
      })
      activityAction = ActivityActions.STAGE_REOPENED
    } else if (action === 'assign') {
      updateData = withUpdateAttribution(session, {
        assignedTo
      })
      activityAction = ActivityActions.STAGE_ASSIGNED
    }
    
    if (dueDate) {
      updateData.dueDate = new Date(dueDate)
    }
    
    const updatedStage = await prisma.stage.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        assignedUser: {
          select: { name: true, email: true }
        },
        updatedBy: {
          select: { name: true, email: true }
        },
        completedBy: {
          select: { name: true, email: true }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: activityAction,
      entity: EntityTypes.STAGE,
      entityId: resolvedParams.id,
      details: {
        action,
        stageName: `${stage.type} - ${stage.room?.name || stage.room?.type}`,
        previousStatus: stage.status,
        newStatus: updateData.status,
        assignedTo
      },
      ipAddress
    })
    
    return NextResponse.json(updatedStage)
  } catch (error) {
    console.error('Error updating stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get stage details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        assignedUser: {
          select: { name: true, email: true }
        },
        designSections: {
          include: {
            assets: {
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              select: { name: true, id: true }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error fetching stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
