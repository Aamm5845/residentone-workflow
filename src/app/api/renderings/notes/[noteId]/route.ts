import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// PATCH /api/renderings/notes/[noteId] - Update a rendering note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { noteId } = resolvedParams
    const data = await request.json()
    const { content } = data

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    // Verify note access and ownership
    const existingNote = await prisma.renderingNote.findFirst({
      where: {
        id: noteId,
        version: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        author: {
          select: { id: true, name: true }
        },
        version: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Only allow the author to edit their own note
    if (existingNote.authorId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own notes' }, { status: 403 })
    }

    // Update the note
    const updatedNote = await prisma.renderingNote.update({
      where: { id: noteId },
      data: withUpdateAttribution(session, {
        content: content.trim()
      }),
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.UPDATE,
      entity: 'RENDERING_NOTE',
      entityId: noteId,
      details: {
        previousContent: existingNote.content,
        newContent: content.trim(),
        version: existingNote.version.version,
        roomName: existingNote.version.room.name || existingNote.version.room.type,
        projectName: existingNote.version.room.project.name,
        message: `Note edited in ${existingNote.version.version}`
      },
      ipAddress
    })

    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('Error updating rendering note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/renderings/notes/[noteId] - Delete a rendering note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { noteId } = resolvedParams

    // Verify note access and ownership
    const existingNote = await prisma.renderingNote.findFirst({
      where: {
        id: noteId,
        version: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        author: {
          select: { id: true, name: true }
        },
        version: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Only allow the author to delete their own note (or admins)
    const isAuthor = existingNote.authorId === session.user.id
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'OWNER'
    
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
    }

    // Delete the note
    await prisma.renderingNote.delete({
      where: { id: noteId }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.DELETE,
      entity: 'RENDERING_NOTE',
      entityId: noteId,
      details: {
        deletedContent: existingNote.content,
        authorName: existingNote.author.name,
        version: existingNote.version.version,
        roomName: existingNote.version.room.name || existingNote.version.room.type,
        projectName: existingNote.version.room.project.name,
        message: `Note deleted from ${existingNote.version.version}`
      },
      ipAddress
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rendering note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}