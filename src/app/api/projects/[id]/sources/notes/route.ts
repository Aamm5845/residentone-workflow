import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST - Create a new note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    
    const { title, content, category } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create the note as a ProjectSource with isNote flag in metadata
    const source = await prisma.projectSource.create({
      data: {
        projectId,
        category: category || 'CLIENT_NOTES',
        title,
        description: content || null,
        // No file - this is a note
        fileName: null,
        fileSize: null,
        mimeType: 'text/plain',
        dropboxPath: null,
        dropboxUrl: null,
        uploadedBy: session.user.id
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      source: {
        ...source,
        isNote: true,
        noteContent: content
      }
    })

  } catch (error) {
    console.error('[sources/notes] Error creating note:', error)
    return NextResponse.json({ 
      error: 'Failed to create note',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH - Update a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    
    const { sourceId, title, content } = body

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 })
    }

    // Verify access
    const source = await prisma.projectSource.findFirst({
      where: {
        id: sourceId,
        projectId,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!source) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Update the note
    const updated = await prisma.projectSource.update({
      where: { id: sourceId },
      data: {
        title: title || source.title,
        description: content !== undefined ? content : source.description
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      source: updated
    })

  } catch (error) {
    console.error('[sources/notes] Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

