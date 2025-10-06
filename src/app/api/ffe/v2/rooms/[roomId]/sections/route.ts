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
    
    console.log('🔍 Creating section:', { roomId, name, orgId });

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