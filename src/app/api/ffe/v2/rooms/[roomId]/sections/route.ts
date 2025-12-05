import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
    }
    
    const { roomId } = await params
    const { name, description, items = [] } = await request.json()

    if (!roomId || !name?.trim()) {
      return NextResponse.json({ error: 'Room ID and section name are required' }, { status: 400 })
    }

    // Get room instance, create if doesn't exist
    let roomInstance = await prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        sections: { orderBy: { order: 'asc' } }
      }
    })

    if (!roomInstance) {
      // Verify room exists and belongs to user's org
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          project: {
            orgId: orgId
          }
        }
      })

      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      }

      // Create room instance
      roomInstance = await prisma.roomFFEInstance.create({
        data: {
          roomId,
          name: `${room.name || room.type} FFE`,
          status: 'IN_PROGRESS',
          progress: 0,
          createdById: userId,
          updatedById: userId
        },
        include: {
          sections: { orderBy: { order: 'asc' } }
        }
      })
    }

    // Calculate next section order
    const nextOrder = (roomInstance.sections.length > 0) 
      ? Math.max(...roomInstance.sections.map(s => s.order)) + 1 
      : 1

    // Create section with items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create section
      const newSection = await tx.roomFFESection.create({
        data: {
          instanceId: roomInstance.id,
          name: name.trim(),
          description: description?.trim() || null,
          order: nextOrder,
          isExpanded: true,
          isCompleted: false
        }
      })

      // Create items if provided
      const createdItems = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item.name?.trim()) continue

        createdItems.push(await tx.roomFFEItem.create({
          data: {
            sectionId: newSection.id,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            state: 'PENDING',
            isRequired: false,
            isCustom: true,
            order: item.order || i + 1,
            quantity: 1,
            notes: null,
            createdById: userId,
            updatedById: userId
          }
        }))
      }

      return {
        section: newSection,
        items: createdItems
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        section: result.section,
        items: result.items
      },
      message: `Section "${name}" created with ${result.items.length} items`
    })

  } catch (error) {
    console.error('Error creating section:', error)
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    )
  }
}

// Update section name/description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
    }
    
    const { roomId } = await params
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const { name, description } = await request.json()

    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 })
    }

    // Verify section exists and belongs to user's organization
    const existingSection = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId
            }
          }
        }
      }
    })

    if (!existingSection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Update the section
    const updatedSection = await prisma.roomFFESection.update({
      where: { id: sectionId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedSection,
      message: 'Section updated successfully'
    })

  } catch (error) {
    console.error('Error updating section:', error)
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    )
  }
}

// Delete section with item preservation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
    }
    
    const { roomId } = await params
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const deleteItems = searchParams.get('deleteItems') === 'true' // Delete items instead of moving
    const targetSectionId = searchParams.get('targetSectionId') // Where to move items (if not deleting)
    
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 })
    }

    // Verify section exists and belongs to user's organization
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId
            }
          }
        }
      },
      include: {
        items: true,
        instance: {
          include: {
            sections: {
              where: {
                id: { not: sectionId } // Get other sections
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const { items, instance } = section
    let targetSection = null

    // If items exist and we're NOT deleting them, determine where to move them
    if (items.length > 0 && !deleteItems) {
      if (targetSectionId) {
        // Move to specified section
        targetSection = await prisma.roomFFESection.findFirst({
          where: {
            id: targetSectionId,
            instanceId: instance.id
          }
        })
        
        if (!targetSection) {
          return NextResponse.json({ 
            error: 'Target section not found' 
          }, { status: 404 })
        }
      } else {
        // Use first available section or create a default one
        if (instance.sections.length > 0) {
          targetSection = instance.sections[0]
        } else {
          // Create a default "Uncategorized" section
          targetSection = await prisma.roomFFESection.create({
            data: {
              instanceId: instance.id,
              name: 'Uncategorized',
              description: 'Items moved from deleted sections',
              order: 1,
              isExpanded: true,
              isCompleted: false
            }
          })
        }
      }
    }

    // Perform deletion with item handling in a transaction
    const result = await prisma.$transaction(async (tx) => {
      if (deleteItems && items.length > 0) {
        // Delete all items in the section
        await tx.roomFFEItem.deleteMany({
          where: { sectionId: sectionId }
        })
      } else if (items.length > 0 && targetSection) {
        // Move items to target section
        const targetItems = await tx.roomFFEItem.findMany({
          where: { sectionId: targetSection.id },
          orderBy: { order: 'desc' },
          take: 1
        })
        
        const startOrder = targetItems.length > 0 ? targetItems[0].order + 1 : 1
        
        // Move items to target section
        for (let i = 0; i < items.length; i++) {
          await tx.roomFFEItem.update({
            where: { id: items[i].id },
            data: {
              sectionId: targetSection.id,
              order: startOrder + i,
              updatedById: userId
            }
          })
        }
      }
      
      // Delete the section
      await tx.roomFFESection.delete({
        where: { id: sectionId }
      })
      
      return {
        deletedSectionName: section.name,
        itemsDeleted: deleteItems ? items.length : 0,
        movedItemsCount: deleteItems ? 0 : items.length,
        targetSectionName: targetSection?.name || null
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: result.itemsDeleted > 0
        ? `Section "${result.deletedSectionName}" and ${result.itemsDeleted} items deleted.`
        : result.movedItemsCount > 0 
          ? `Section "${result.deletedSectionName}" deleted. ${result.movedItemsCount} items moved to "${result.targetSectionName}".`
          : `Section "${result.deletedSectionName}" deleted.`
    })

  } catch (error) {
    console.error('Error deleting section:', error)
    return NextResponse.json(
      { error: 'Failed to delete section' },
      { status: 500 }
    )
  }
}
