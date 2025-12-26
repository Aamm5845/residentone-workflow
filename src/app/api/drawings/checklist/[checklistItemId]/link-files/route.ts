import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service-v2'

// Helper function to safely serialize Prisma results
function sanitizeForJson(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value)
      }
      return value
    })
  )
}

// POST /api/drawings/checklist/{checklistItemId}/link-files
// Link Dropbox files to a drawing checklist item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checklistItemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { checklistItemId } = await params
    const { dropboxFiles } = await request.json()

    if (!checklistItemId || !dropboxFiles || !Array.isArray(dropboxFiles)) {
      return NextResponse.json(
        { error: 'Checklist item ID and dropboxFiles array are required' },
        { status: 400 }
      )
    }

    // Verify user has access to this checklist item
    const checklistItem = await prisma.drawingChecklistItem.findUnique({
      where: { id: checklistItemId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    organization: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!checklistItem || checklistItem.stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Checklist item not found or access denied' }, { status: 404 })
    }

    // Link the files
    const linkedFiles = []
    const skippedFiles: Array<{ path: string; id?: string; reason: string }> = []

    for (const file of dropboxFiles) {
      try {
        console.log('[link-files-drawing] Incoming file:', { id: file.id, path: file.path, name: file.name })

        // Get metadata using the file path
        const metadataPath = file.path || file.id
        const metadata = await dropboxService.getFileMetadata(metadataPath)
        if (!metadata) {
          console.warn(`[link-files-drawing] Metadata lookup failed, skipping: ${file.path} (id: ${file.id || 'n/a'})`)
          skippedFiles.push({ path: file.path, id: file.id, reason: 'metadata_not_found' })
          continue
        }

        console.log('[link-files-drawing] Metadata found:', { id: metadata.id, name: metadata.name, revision: metadata.revision })

        // Create or update the file link
        const fileLink = await prisma.dropboxFileLink.upsert({
          where: {
            // Use composite unique key handling - we need to check manually since we have both optional fields
            // For now, use a separate find and create/update pattern
            id: (await prisma.dropboxFileLink.findFirst({
              where: {
                drawingChecklistItemId: checklistItemId,
                dropboxPath: file.path
              }
            }))?.id || 'new'
          },
          update: {
            dropboxFileId: metadata.id || file.id || null,
            fileName: metadata.name || file.name,
            fileSize: metadata.size || file.size,
            lastModified: metadata.lastModified || (file.lastModified ? new Date(file.lastModified) : new Date()),
            dropboxRevision: metadata.revision || null,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            drawingChecklistItemId: checklistItemId,
            dropboxPath: file.path,
            dropboxFileId: metadata.id || file.id || null,
            fileName: metadata.name || file.name,
            fileSize: metadata.size || file.size,
            lastModified: metadata.lastModified || (file.lastModified ? new Date(file.lastModified) : new Date()),
            dropboxRevision: metadata.revision || null,
            isActive: true
          }
        })

        linkedFiles.push({
          id: fileLink.id,
          fileName: fileLink.fileName,
          dropboxPath: fileLink.dropboxPath,
          fileSize: fileLink.fileSize,
          lastModified: fileLink.lastModified
        })

      } catch (error) {
        console.error(`Failed to link file ${file.path}:`, error)
        skippedFiles.push({ path: file.path, id: file.id, reason: 'exception' })
        // Continue with other files
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'LINK_DROPBOX_FILES_TO_DRAWING',
        entity: 'DRAWING_CHECKLIST_ITEM',
        entityId: checklistItemId,
        details: {
          checklistItemId,
          checklistItemName: checklistItem.name,
          linkedCount: linkedFiles.length,
          skippedCount: skippedFiles.length,
          files: linkedFiles.map(f => f.fileName)
        },
        orgId: session.user.orgId
      }
    })

    // Sanitize the response to avoid serialization issues
    const sanitized = sanitizeForJson({
      success: true,
      linkedFiles,
      skippedFiles,
      checklistItem: {
        id: checklistItem.id,
        name: checklistItem.name
      }
    })

    return NextResponse.json(sanitized)

  } catch (error) {
    console.error('Link files API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/drawings/checklist/{checklistItemId}/link-files
// Unlink a Dropbox file from a drawing checklist item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ checklistItemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { checklistItemId } = await params
    const { dropboxPath } = await request.json()

    console.log('[UNLINK-DRAWING] Request data:', {
      checklistItemId,
      dropboxPath
    })

    if (!checklistItemId || !dropboxPath) {
      return NextResponse.json(
        { error: 'Checklist item ID and dropboxPath are required' },
        { status: 400 }
      )
    }

    // Verify user has access to this checklist item
    const checklistItem = await prisma.drawingChecklistItem.findUnique({
      where: { id: checklistItemId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    organization: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!checklistItem || checklistItem.stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Checklist item not found or access denied' }, { status: 404 })
    }

    // Delete the file link
    const result = await prisma.dropboxFileLink.deleteMany({
      where: {
        drawingChecklistItemId: checklistItemId,
        dropboxPath
      }
    })

    console.log(`[UNLINK-DRAWING] Deleted ${result.count} file link(s)`)

    // Log activity
    if (result.count > 0) {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          action: 'UNLINK_DROPBOX_FILE_FROM_DRAWING',
          entity: 'DRAWING_CHECKLIST_ITEM',
          entityId: checklistItemId,
          details: {
            checklistItemId,
            checklistItemName: checklistItem.name,
            dropboxPath,
            unlinkedCount: result.count
          },
          orgId: session.user.orgId
        }
      })
    }

    return NextResponse.json({
      success: true,
      unlinkedCount: result.count
    })

  } catch (error) {
    console.error('Unlink file API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
