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
    if (section) {
      // Support both new renderingUrls array and legacy single renderingUrl
      const urls = section.renderingUrls && section.renderingUrls.length > 0 
        ? section.renderingUrls 
        : section.renderingUrl ? [section.renderingUrl] : []
      
      urls.forEach((url, index) => {
        renderings.push({
          id: `${section.id}-${index}`,
          imageUrl: url,
          filename: `rendering-${index + 1}.jpg`,
          fileSize: 0 // We don't store file size currently
        })
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

    // Get existing section to append to renderingUrls array
    const existingSection = await prisma.specBookSection.findUnique({
      where: {
        specBookId_type_roomId: {
          specBookId: specBook.id,
          type: 'ROOM',
          roomId: roomId
        }
      }
    })
    
    const currentUrls = existingSection?.renderingUrls || []
    const updatedUrls = [...currentUrls, imageUrl]
    
    // Update or create section with rendering URLs array
    const section = await prisma.specBookSection.upsert({
      where: {
        specBookId_type_roomId: {
          specBookId: specBook.id,
          type: 'ROOM',
          roomId: roomId
        }
      },
      update: {
        renderingUrl: imageUrl, // Keep for backward compatibility
        renderingUrls: updatedUrls
      },
      create: {
        specBookId: specBook.id,
        type: 'ROOM',
        name: room.name || room.type.replace('_', ' '),
        roomId: roomId,
        order: 100,
        renderingUrl: imageUrl,
        renderingUrls: [imageUrl]
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

    const { renderingId, imageUrl } = await request.json()

    if (!renderingId) {
      return NextResponse.json({ error: 'renderingId is required' }, { status: 400 })
    }

    // Extract section ID and index from composite rendering ID
    const [sectionId, indexStr] = renderingId.split('-')
    const index = parseInt(indexStr, 10)
    
    // Get the section
    const section = await prisma.specBookSection.findUnique({
      where: { id: sectionId }
    })
    
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    
    // Remove the specific URL from the array
    const currentUrls = section.renderingUrls || []
    const updatedUrls = currentUrls.filter((url, i) => {
      // Support both index-based removal and URL-based removal
      return imageUrl ? url !== imageUrl : i !== index
    })
    
    // Update section with new array
    await prisma.specBookSection.update({
      where: { id: sectionId },
      data: {
        renderingUrls: updatedUrls,
        // Keep renderingUrl as the first URL if available, otherwise null
        renderingUrl: updatedUrls.length > 0 ? updatedUrls[0] : null
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