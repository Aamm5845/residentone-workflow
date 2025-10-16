import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // Get spec book section for this room
    const section = await prisma.specBookSection.findFirst({
      where: {
        roomId: roomId,
        type: 'ROOM',
        specBook: {
          isActive: true
        }
      }
    })

    const renderings = []
    if (section && section.renderingUrl) {
      renderings.push({
        id: section.id,
        imageUrl: section.renderingUrl,
        filename: 'rendering.jpg',
        fileSize: 0 // We don't store file size currently
      })
    }

    return NextResponse.json({
      success: true,
      renderings
    })

  } catch (error) {
    console.error('Error fetching room renderings:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId, imageUrl } = await request.json()

    if (!roomId || !imageUrl) {
      return NextResponse.json({ error: 'roomId and imageUrl are required' }, { status: 400 })
    }

    // Find or create spec book for the room
    const room = await prisma.room.findFirst({
      where: { id: roomId },
      include: { project: true }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get or create spec book
    let specBook = await prisma.specBook.findFirst({
      where: {
        projectId: room.projectId,
        isActive: true
      }
    })

    if (!specBook) {
      specBook = await prisma.specBook.create({
        data: {
          projectId: room.projectId,
          name: `${room.project.name} Spec Book`,
          description: 'Auto-generated spec book',
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }

    // Update or create section with rendering URL
    const section = await prisma.specBookSection.upsert({
      where: {
        specBookId_type_roomId: {
          specBookId: specBook.id,
          type: 'ROOM',
          roomId: roomId
        }
      },
      update: {
        renderingUrl: imageUrl
      },
      create: {
        specBookId: specBook.id,
        type: 'ROOM',
        name: room.name || room.type.replace('_', ' '),
        roomId: roomId,
        order: 100,
        renderingUrl: imageUrl
      }
    })

    return NextResponse.json({
      success: true,
      sectionId: section.id
    })

  } catch (error) {
    console.error('Error updating room rendering:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { renderingId } = await request.json()

    if (!renderingId) {
      return NextResponse.json({ error: 'renderingId is required' }, { status: 400 })
    }

    // Remove rendering URL from section
    await prisma.specBookSection.update({
      where: { id: renderingId },
      data: {
        renderingUrl: null
      }
    })

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Error removing room rendering:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}