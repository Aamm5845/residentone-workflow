import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams
    const { name, description, quantity, state } = await request.json()

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and Item ID are required' 
      }, { status: 400 })
    }

    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: orgId
              }
            }
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Update the item
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(quantity !== undefined && { quantity }),
        ...(state !== undefined && { state }),
        updatedById: userId,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    })

  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and Item ID are required' 
      }, { status: 400 })
    }

    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: orgId
              }
            }
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete the item
    await prisma.roomFFEItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}

// Move item to different section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams
    const { targetSectionId } = await request.json()

    if (!roomId || !itemId || !targetSectionId) {
      return NextResponse.json({ 
        error: 'Room ID, Item ID, and target section ID are required' 
      }, { status: 400 })
    }

    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          select: {
            name: true
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify target section exists and belongs to same room instance
    const targetSection = await prisma.roomFFESection.findFirst({
      where: {
        id: targetSectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId: orgId
            }
          }
        }
      }
    })

    if (!targetSection) {
      return NextResponse.json({ error: 'Target section not found' }, { status: 404 })
    }

    // Don't move if already in the target section
    if (existingItem.sectionId === targetSectionId) {
      return NextResponse.json({
        success: true,
        message: 'Item is already in the target section'
      })
    }

    // Get the highest order in target section for positioning
    const targetSectionItems = await prisma.roomFFEItem.findMany({
      where: { sectionId: targetSectionId },
      orderBy: { order: 'desc' },
      take: 1
    })

    const newOrder = targetSectionItems.length > 0 ? targetSectionItems[0].order + 1 : 1

    // Move the item
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        sectionId: targetSectionId,
        order: newOrder,
        updatedById: userId,
        updatedAt: new Date()
      },
      include: {
        section: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: `Item "${updatedItem.name}" moved from "${existingItem.section.name}" to "${updatedItem.section.name}"`
    })

  } catch (error) {
    console.error('Error moving item:', error)
    return NextResponse.json(
      { error: 'Failed to move item' },
      { status: 500 }
    )
  }
}
