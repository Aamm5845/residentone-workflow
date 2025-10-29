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
        // Use the URL as ID for stability - extract filename from URL
        const filename = url.split('/').pop()?.split('?')[0] || `rendering-${index + 1}.jpg`
        renderings.push({
          id: url, // Use URL as stable ID
          sectionId: section.id, // Include section ID for deletion
          imageUrl: url,
          filename: filename,
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

    const { renderingId, roomId } = await request.json()

    if (!renderingId || !roomId) {
      return NextResponse.json({ error: 'renderingId and roomId are required' }, { status: 400 })
    }

    // renderingId is now the URL itself
    const urlToRemove = renderingId
    
    // Get the section for this room
    const section = await prisma.specBookSection.findFirst({
      where: {
        roomId: roomId,
        type: 'ROOM',
        specBook: {
          isActive: true
        }
      }
    })
    
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    
    // Remove the specific URL from the array
    const currentUrls = section.renderingUrls || []
    const updatedUrls = currentUrls.filter(url => url !== urlToRemove)
    
    console.log(`[DELETE] Removing ${urlToRemove} from room ${roomId}`)
    console.log(`[DELETE] Current URLs:`, currentUrls)
    console.log(`[DELETE] Updated URLs:`, updatedUrls)
    
    // Update section with new array
    await prisma.specBookSection.update({
      where: { id: section.id },
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
