import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { sectionId, name, description, quantity = 1 } = await request.json()

    if (!roomId || !sectionId || !name?.trim()) {
      return NextResponse.json({ 
        error: 'Room ID, section ID, and item name are required' 
      }, { status: 400 })
    }

    if (quantity < 1 || quantity > 50) {
      return NextResponse.json({ 
        error: 'Quantity must be between 1 and 50' 
      }, { status: 400 })
    }

    // Verify section belongs to room instance
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        items: { orderBy: { order: 'asc' } }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Calculate next order
    const nextOrder = (section.items.length > 0)
      ? Math.max(...section.items.map(i => i.order)) + 1
      : 1

    // Create items based on quantity
    const createdItems = []
    
    await prisma.$transaction(async (tx) => {
      for (let i = 1; i <= quantity; i++) {
        const itemName = quantity > 1 ? `${name.trim()} #${i}` : name.trim()
        
        const newItem = await tx.roomFFEItem.create({
          data: {
            sectionId,
            name: itemName,
            description: description?.trim() || null,
            state: 'PENDING',
            isRequired: false,
            isCustom: true,
            order: nextOrder + i - 1,
            quantity: 1, // Each created item has quantity 1
            notes: null,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
        
        createdItems.push(newItem)
      }
    })

    return NextResponse.json({
      success: true,
      data: createdItems,
      message: `Added ${quantity} item${quantity > 1 ? 's' : ''} to section`
    })

  } catch (error) {
    console.error('Error adding items:', error)
    return NextResponse.json(
      { error: 'Failed to add items' },
      { status: 500 }
    )
  }
}

// Update item state and notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { itemId, state, notes } = await request.json()

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and item ID are required' 
      }, { status: 400 })
    }

    // Verify item belongs to room instance
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      updatedById: session.user.id
    }

    if (state) {
      updateData.state = state
      if (state === 'COMPLETED') {
        updateData.completedAt = new Date()
        updateData.completedById = session.user.id
      } else {
        updateData.completedAt = null
        updateData.completedById = null
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null
    }

    // Update item
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: updateData
    })

    // Calculate section progress
    const sectionItems = await prisma.roomFFEItem.findMany({
      where: { sectionId: item.sectionId }
    })

    const completedItems = sectionItems.filter(i => i.state === 'COMPLETED').length
    const sectionProgress = sectionItems.length > 0 
      ? (completedItems / sectionItems.length) * 100 
      : 0

    // Update section completion status
    await prisma.roomFFESection.update({
      where: { id: item.sectionId },
      data: {
        isCompleted: sectionProgress === 100
      }
    })

    // Calculate overall instance progress
    const allSections = await prisma.roomFFESection.findMany({
      where: {
        instance: {
          roomId
        }
      },
      include: {
        items: true
      }
    })

    const allItems = allSections.flatMap(s => s.items)
    const allCompletedItems = allItems.filter(i => i.state === 'COMPLETED').length
    const overallProgress = allItems.length > 0 
      ? (allCompletedItems / allItems.length) * 100 
      : 0

    // Update room instance progress
    await prisma.roomFFEInstance.update({
      where: { roomId },
      data: {
        progress: overallProgress,
        status: overallProgress === 100 ? 'COMPLETED' : 'IN_PROGRESS'
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedItem,
      progress: {
        section: sectionProgress,
        overall: overallProgress
      }
    })

  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// Delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const itemIds = searchParams.get('itemIds') // For bulk delete

    // Handle bulk delete
    if (itemIds) {
      const idsArray = itemIds.split(',')
      if (idsArray.length === 0) {
        return NextResponse.json({ 
          error: 'Item IDs are required for bulk delete' 
        }, { status: 400 })
      }

      // Verify all items belong to room instance
      const items = await prisma.roomFFEItem.findMany({
        where: {
          id: { in: idsArray },
          section: {
            instance: {
              roomId,
              room: {
                project: {
                  orgId: session.user.orgId
                }
              }
            }
          }
        }
      })

      if (items.length !== idsArray.length) {
        return NextResponse.json({ 
          error: 'Some items not found or access denied' 
        }, { status: 404 })
      }

      // Delete all items
      await prisma.roomFFEItem.deleteMany({
        where: { id: { in: idsArray } }
      })

      return NextResponse.json({
        success: true,
        message: `${idsArray.length} items deleted successfully`
      })
    }

    // Handle single delete
    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and item ID are required' 
      }, { status: 400 })
    }

    // Verify item belongs to room instance
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete item
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