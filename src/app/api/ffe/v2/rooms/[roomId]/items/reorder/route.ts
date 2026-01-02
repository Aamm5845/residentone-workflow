import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Reorder items within a section
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id
    let orgId = session.user.orgId

    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userId = user.id
      orgId = user.orgId
    }

    const { roomId } = await params
    const { itemId, direction, sectionId } = await request.json()

    if (!roomId || !itemId || !direction || !sectionId) {
      return NextResponse.json({
        error: 'Room ID, item ID, direction (up/down), and section ID are required'
      }, { status: 400 })
    }

    if (direction !== 'up' && direction !== 'down') {
      return NextResponse.json({
        error: 'Direction must be "up" or "down"'
      }, { status: 400 })
    }

    // Verify section belongs to room and user's organization
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
        items: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Find the item and its current position
    const items = section.items
    const currentIndex = items.findIndex(i => i.id === itemId)

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Item not found in section' }, { status: 404 })
    }

    // Calculate swap index
    let swapIndex: number
    if (direction === 'up') {
      if (currentIndex === 0) {
        return NextResponse.json({
          success: true,
          message: 'Item is already at the top'
        })
      }
      swapIndex = currentIndex - 1
    } else {
      if (currentIndex === items.length - 1) {
        return NextResponse.json({
          success: true,
          message: 'Item is already at the bottom'
        })
      }
      swapIndex = currentIndex + 1
    }

    // Get the items to swap
    const currentItem = items[currentIndex]
    const swapItem = items[swapIndex]

    // Swap orders in a transaction
    await prisma.$transaction([
      prisma.roomFFEItem.update({
        where: { id: currentItem.id },
        data: {
          order: swapItem.order,
          updatedById: userId
        }
      }),
      prisma.roomFFEItem.update({
        where: { id: swapItem.id },
        data: {
          order: currentItem.order,
          updatedById: userId
        }
      })
    ])

    return NextResponse.json({
      success: true,
      message: `Item moved ${direction}`,
      data: {
        movedItemId: currentItem.id,
        swappedWithId: swapItem.id
      }
    })

  } catch (error) {
    console.error('Error reordering items:', error)
    return NextResponse.json(
      { error: 'Failed to reorder items' },
      { status: 500 }
    )
  }
}
