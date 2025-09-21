import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/projects/[id]/floors/[floorId] - Update floor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; floorId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, floorId } = await params
    const body = await request.json()
    const { name, order } = body

    const floor = await prisma.floor.update({
      where: { 
        id: floorId,
        projectId // Ensure floor belongs to this project
      },
      data: {
        ...(name && { name }),
        ...(order !== undefined && { order })
      },
      include: {
        rooms: true
      }
    })

    return NextResponse.json(floor)
  } catch (error) {
    console.error('Error updating floor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/floors/[floorId] - Delete floor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; floorId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, floorId } = await params

    // Check if floor has rooms - prevent deletion if it has rooms
    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { _count: { select: { rooms: true } } }
    })

    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
    }

    if (floor._count.rooms > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete floor with rooms. Please move or delete all rooms first.' 
      }, { status: 400 })
    }

    await prisma.floor.delete({
      where: { 
        id: floorId,
        projectId // Ensure floor belongs to this project
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting floor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}