import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { roomId } = await params
    const body = await request.json()
    const { startDate, dueDate } = body

    // Validate room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        stages: true
      }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Update room with start date and due date
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        updatedAt: new Date()
      }
    })

    // If dueDate is set, update all phase due dates
    if (dueDate && room.stages.length > 0) {
      await Promise.all(
        room.stages.map(stage =>
          prisma.stage.update({
            where: { id: stage.id },
            data: {
              dueDate: new Date(dueDate),
              updatedAt: new Date()
            }
          })
        )
      )
    }

    return NextResponse.json({
      success: true,
      room: updatedRoom
    })
  } catch (error) {
    console.error('Error updating room settings:', error)
    return NextResponse.json(
      { error: 'Failed to update room settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
