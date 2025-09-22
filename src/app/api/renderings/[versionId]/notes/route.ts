import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// GET /api/renderings/[versionId]/notes - Get notes for a rendering version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams

    // Verify rendering version access - simplified to match GET /api/renderings logic
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    const notes = await prisma.renderingNote.findMany({
      where: {
        versionId: versionId
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Error fetching rendering notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/renderings/[versionId]/notes - Add a note to a rendering version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams
    const data = await request.json()
    const { content } = data

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    // Verify rendering version access - simplified to match GET /api/renderings logic
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Create the note
    const note = await prisma.renderingNote.create({
      data: {
        versionId: versionId,
        content: content.trim(),
        authorId: session.user.id
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.CREATE,
      entity: 'RENDERING_NOTE',
      entityId: note.id,
      details: {
        noteContent: content.trim(),
        version: renderingVersion.version,
        roomName: renderingVersion.room.name || renderingVersion.room.type,
        projectName: renderingVersion.room.project.name,
        message: `Note added to ${renderingVersion.version}`
      },
      ipAddress
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating rendering note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}