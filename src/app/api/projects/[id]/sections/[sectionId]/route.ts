import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

// PUT update a section
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: { id: string; orgId: string; role: string }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, order } = data

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (order !== undefined) updateData.order = order

    const section = await prisma.roomSection.update({
      where: { id: resolvedParams.sectionId },
      data: updateData,
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    })

    return NextResponse.json(section)
  } catch (error) {
    console.error('Error updating section:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE a section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: { id: string; orgId: string; role: string }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if section has rooms
    const roomCount = await prisma.room.count({
      where: { sectionId: resolvedParams.sectionId }
    })

    if (roomCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete section with rooms. Please move or delete all rooms first.' 
      }, { status: 400 })
    }

    await prisma.roomSection.delete({
      where: { id: resolvedParams.sectionId }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Section deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting section:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
