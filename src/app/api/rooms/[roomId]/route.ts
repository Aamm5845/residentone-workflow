import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify room exists and get project info
    const room = await prisma.room.findUnique({
      where: { id: resolvedParams.roomId },
      include: { project: true }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Delete related data in the correct order to respect foreign key constraints
    // 1. Delete design sections first (they reference stages)
    await prisma.designSection.deleteMany({
      where: {
        stage: {
          roomId: resolvedParams.roomId
        }
      }
    })

    // 2. Delete chat messages related to stages
    await prisma.chatMessage.deleteMany({
      where: {
        stageId: {
          in: await prisma.stage.findMany({
            where: { roomId: resolvedParams.roomId },
            select: { id: true }
          }).then(stages => stages.map(s => s.id))
        }
      }
    })

    // 3. Delete stages
    await prisma.stage.deleteMany({
      where: { roomId: resolvedParams.roomId }
    })

    // 4. Delete FFE items
    await prisma.fFEItem.deleteMany({
      where: { roomId: resolvedParams.roomId }
    })

    // 5. Delete any comments related to the room
    await prisma.comment.deleteMany({
      where: { roomId: resolvedParams.roomId }
    })

    // 6. Delete any renderings related to the room
    await prisma.renderingVersion.deleteMany({
      where: { roomId: resolvedParams.roomId }
    })

    // 7. Finally delete the room itself
    await prisma.room.delete({
      where: { id: resolvedParams.roomId }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Room deleted successfully',
      deletedRoomId: resolvedParams.roomId
    })

  } catch (error) {
    console.error('Error deleting room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get room with all related data
    const room = await prisma.room.findUnique({
      where: { id: resolvedParams.roomId },
      include: {
        project: true,
        stages: {
          include: {
            assignedUser: {
              select: { name: true }
            },
            designSections: true
          }
        },
        ffeItems: true,
        comments: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        renderingVersions: true
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    return NextResponse.json(room)

  } catch (error) {
    console.error('Error fetching room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}