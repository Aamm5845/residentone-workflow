import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Bulk reorder items across sections (used by board view drag-and-drop)
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
    let orgId = (session.user as any).orgId

    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { id: true, orgId: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userId = user.id
      orgId = user.orgId
    }

    const { roomId } = await params
    const { items } = await request.json()

    if (!roomId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: 'Room ID and items array are required'
      }, { status: 400 })
    }

    // Validate items structure
    for (const item of items) {
      if (!item.id || !item.sectionId || typeof item.order !== 'number') {
        return NextResponse.json({
          error: 'Each item must have id, sectionId, and order'
        }, { status: 400 })
      }
    }

    // Verify room belongs to user's organization
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: { orgId }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Update all items in a transaction
    await prisma.$transaction(
      items.map((item: { id: string; sectionId: string; order: number }) =>
        prisma.roomFFEItem.update({
          where: { id: item.id },
          data: {
            sectionId: item.sectionId,
            order: item.order,
            updatedById: userId,
            updatedAt: new Date()
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: `Reordered ${items.length} items`
    })

  } catch (error) {
    console.error('Error bulk reordering items:', error)
    return NextResponse.json(
      { error: 'Failed to reorder items' },
      { status: 500 }
    )
  }
}
