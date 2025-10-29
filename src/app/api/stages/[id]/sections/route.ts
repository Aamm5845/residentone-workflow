import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import {
  withCreateAttribution,
  withUpdateAttribution,
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// GET method to fetch stage sections data
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

    // Find the stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        designSections: {
          include: {
            assets: {
              select: {
                id: true,
                title: true,
                url: true,
                type: true,
                userDescription: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { id: true, name: true, role: true }
                },
                commentPin: {
                  select: { userId: true }
                },
                commentLikes: {
                  select: { userId: true }
                },
                commentTags: {
                  include: {
                    tag: {
                      select: { id: true, name: true, color: true }
                    }
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            },
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          }
        },
        assignedUser: {
          select: { id: true, name: true }
        },
        room: {
          include: {
            project: {
              include: {
                client: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Calculate completion statistics - dynamic based on actual sections
    const totalSections = stage.designSections?.length || 0
    const completedSections = stage.designSections?.filter(section => section.completed).length || 0
    const percentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0

    // Format the response data
    const responseData = {
      stage: {
        id: stage.id,
        type: stage.type,
        status: stage.status,
        assignedUser: stage.assignedUser,
        dueDate: stage.dueDate,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        designSections: stage.designSections || []
      },
      room: {
        id: stage.room.id,
        type: stage.room.type,
        name: stage.room.name
      },
      project: {
        id: stage.room.project.id,
        name: stage.room.project.name,
        client: stage.room.project.client
      },
      completion: {
        percentage,
        completedSections,
        totalSections
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching stage sections:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown',
      stageId: resolvedParams?.id
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stageId: resolvedParams?.id
    }, { status: 500 })
  }
}

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
    const { sectionType, content, isComplete, action } = data

    // Validate section type - allow custom sections
    if (!sectionType || typeof sectionType !== 'string') {
      return NextResponse.json({ error: 'Invalid section type' }, { status: 400 })
    }

    // Find the stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        designSections: true,
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Find or create the design section
    let designSection = stage.designSections?.find(section => section.type === sectionType)
    
    if (designSection) {
      // Update existing section
      let updateData: any = {}
      if (content !== undefined) {
        updateData = withUpdateAttribution(session, { content })
      }
      if (action === 'mark_complete' && isComplete !== undefined) {
        const completionData = isComplete 
          ? withCompletionAttribution(session, { completed: isComplete })
          : withUpdateAttribution(session, { completed: isComplete, completedById: null })
        updateData = { ...updateData, ...completionData }
      }
      
      designSection = await prisma.designSection.update({
        where: { id: designSection.id },
        data: updateData
      })
    } else {
      // Create new section
      designSection = await prisma.designSection.create({
        data: withCreateAttribution(session, {
          stageId: stage.id,
          type: sectionType,
          content: content || '',
          completed: isComplete || false,
          ...(isComplete && { completedById: session.user.id })
        })
      })
    }

    // Log the activity
    let activityAction = content !== undefined ? ActivityActions.SECTION_UPDATED : ActivityActions.SECTION_COMPLETED
    if (!designSection.id) {
      activityAction = ActivityActions.SECTION_CREATED
    }

    await logActivity({
      session,
      action: activityAction,
      entity: EntityTypes.DESIGN_SECTION,
      entityId: designSection.id,
      details: {
        sectionType,
        stageName: `${stage.type} - ${stage.room?.name || stage.room?.type}`,
        projectName: stage.room?.project.name,
        action,
        hasContent: !!content,
        isComplete
      },
      ipAddress
    })

    // Get updated stage with all sections
    const updatedStage = await prisma.stage.findUnique({
      where: { id: stage.id },
      include: {
        designSections: {
          include: {
            assets: true,
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            },
            createdBy: {
              select: { name: true, email: true }
            },
            updatedBy: {
              select: { name: true, email: true }
            },
            completedBy: {
              select: { name: true, email: true }
            }
          }
        },
        room: {
          include: {
            project: true
          }
        }
      }
    })

    return NextResponse.json(updatedStage)
  } catch (error) {
    console.error('Error updating design section:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST method to create a new custom section
export async function POST(
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
    const { type, content } = data

    // Validate input
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'Section type is required' }, { status: 400 })
    }

    // Find the stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        designSections: true,
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Check if section already exists
    const existingSection = stage.designSections?.find(s => s.type === type)
    if (existingSection) {
      return NextResponse.json({ error: 'Section already exists' }, { status: 400 })
    }

    // Create new section
    const designSection = await prisma.designSection.create({
      data: withCreateAttribution(session, {
        stageId: stage.id,
        type: type,
        content: content || '',
        completed: false
      })
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.SECTION_CREATED,
      entity: EntityTypes.DESIGN_SECTION,
      entityId: designSection.id,
      details: {
        sectionType: type,
        stageName: `${stage.type} - ${stage.room?.name || stage.room?.type}`,
        projectName: stage.room?.project.name,
        isCustomSection: true
      },
      ipAddress
    })

    return NextResponse.json(designSection, { status: 201 })
  } catch (error) {
    console.error('Error creating custom section:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
