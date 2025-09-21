import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
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

// Create a new checklist item
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { sectionId, title, description, order } = data

    if (!sectionId || !title?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: sectionId and title' 
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // If no order specified, put it at the end
    let itemOrder = order
    if (itemOrder === undefined || itemOrder === null) {
      const maxOrder = await prisma.checklistItem.aggregate({
        where: { sectionId },
        _max: { order: true }
      })
      itemOrder = (maxOrder._max.order || 0) + 1
    }

    // Create the checklist item
    const checklistItem = await prisma.checklistItem.create({
      data: withCreateAttribution(session, {
        sectionId: sectionId,
        title: title.trim(),
        description: description?.trim() || null,
        order: itemOrder,
        completed: false,
        createdById: session.user.id
      }),
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.CHECKLIST_ITEM_CREATED,
      entity: EntityTypes.CHECKLIST_ITEM,
      entityId: checklistItem.id,
      details: {
        itemTitle: title,
        sectionType: section.type,
        sectionName: section.type,
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name,
        hasDescription: !!description,
        order: itemOrder
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      checklistItem: {
        id: checklistItem.id,
        title: checklistItem.title,
        description: checklistItem.description,
        completed: checklistItem.completed,
        order: checklistItem.order,
        createdAt: checklistItem.createdAt,
        completedAt: checklistItem.completedAt,
        createdBy: checklistItem.createdBy,
        completedBy: checklistItem.completedBy
      }
    })

  } catch (error) {
    console.error('Error creating checklist item:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get all checklist items for a section
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const sectionId = url.searchParams.get('sectionId')

    if (!sectionId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: sectionId' 
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Get all checklist items for this section
    const checklistItems = await prisma.checklistItem.findMany({
      where: {
        sectionId: sectionId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Calculate completion statistics
    const totalItems = checklistItems.length
    const completedItems = checklistItems.filter(item => item.completed).length
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    return NextResponse.json({
      success: true,
      checklistItems: checklistItems.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        completed: item.completed,
        order: item.order,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
        createdBy: item.createdBy,
        completedBy: item.completedBy
      })),
      statistics: {
        totalItems,
        completedItems,
        completionPercentage
      }
    })

  } catch (error) {
    console.error('Error fetching checklist items:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Update a checklist item (title, description, completed status, order)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { checklistItemId, title, description, completed, order } = data

    if (!checklistItemId) {
      return NextResponse.json({ 
        error: 'Missing required field: checklistItemId' 
      }, { status: 400 })
    }

    // Find the checklist item and verify user has access
    const existingItem = await prisma.checklistItem.findFirst({
      where: {
        id: checklistItemId,
        section: {
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ 
        error: 'Checklist item not found' 
      }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}

    if (title !== undefined) {
      updateData.title = title.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (order !== undefined) {
      updateData.order = order
    }

    // Handle completion status change
    if (completed !== undefined && completed !== existingItem.completed) {
      if (completed) {
        // Marking as complete
        const completionData = withCompletionAttribution(session, {
          completed: true,
          completedAt: new Date()
        })
        Object.assign(updateData, completionData)
      } else {
        // Marking as incomplete
        updateData.completed = false
        updateData.completedById = null
        updateData.completedAt = null
      }
    }

    // Apply other updates
    if (Object.keys(updateData).length > 0 && !updateData.completed) {
      Object.assign(updateData, withUpdateAttribution(session, {}))
    }

    // Update the checklist item
    const updatedItem = await prisma.checklistItem.update({
      where: { id: checklistItemId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Log the activity
    let activityAction = ActivityActions.CHECKLIST_ITEM_UPDATED
    if (completed !== undefined && completed !== existingItem.completed) {
      activityAction = completed ? ActivityActions.CHECKLIST_ITEM_COMPLETED : ActivityActions.CHECKLIST_ITEM_REOPENED
    }

    await logActivity({
      session,
      action: activityAction,
      entity: EntityTypes.CHECKLIST_ITEM,
      entityId: checklistItemId,
      details: {
        itemTitle: updatedItem.title,
        sectionType: existingItem.section.type,
        sectionName: existingItem.section.type,
        stageName: `${existingItem.section.stage.type} - ${existingItem.section.stage.room.name || existingItem.section.stage.room.type}`,
        projectName: existingItem.section.stage.room.project.name,
        wasCompleted: completed,
        previousCompleted: existingItem.completed
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      checklistItem: {
        id: updatedItem.id,
        title: updatedItem.title,
        description: updatedItem.description,
        completed: updatedItem.completed,
        order: updatedItem.order,
        createdAt: updatedItem.createdAt,
        completedAt: updatedItem.completedAt,
        createdBy: updatedItem.createdBy,
        completedBy: updatedItem.completedBy
      }
    })

  } catch (error) {
    console.error('Error updating checklist item:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Delete a checklist item
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const checklistItemId = url.searchParams.get('checklistItemId')

    if (!checklistItemId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: checklistItemId' 
      }, { status: 400 })
    }

    // Find the checklist item and verify user has access
    const existingItem = await prisma.checklistItem.findFirst({
      where: {
        id: checklistItemId,
        section: {
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ 
        error: 'Checklist item not found' 
      }, { status: 404 })
    }

    // Delete the checklist item
    await prisma.checklistItem.delete({
      where: { id: checklistItemId }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.CHECKLIST_ITEM_DELETED,
      entity: EntityTypes.CHECKLIST_ITEM,
      entityId: checklistItemId,
      details: {
        itemTitle: existingItem.title,
        sectionType: existingItem.section.type,
        sectionName: existingItem.section.type,
        stageName: `${existingItem.section.stage.type} - ${existingItem.section.stage.room.name || existingItem.section.stage.room.type}`,
        projectName: existingItem.section.stage.room.project.name,
        wasCompleted: existingItem.completed
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Checklist item deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting checklist item:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
