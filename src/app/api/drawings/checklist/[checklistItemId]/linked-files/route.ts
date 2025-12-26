import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// GET /api/drawings/checklist/{checklistItemId}/linked-files
// Get all linked Dropbox files for a drawing checklist item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ checklistItemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { checklistItemId } = await params

    if (!checklistItemId) {
      return NextResponse.json(
        { error: 'Checklist item ID is required' },
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

    // Fetch linked files
    const linkedFiles = await prisma.dropboxFileLink.findMany({
      where: {
        drawingChecklistItemId: checklistItemId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      linkedFiles: linkedFiles.map(file => ({
        id: file.id,
        dropboxPath: file.dropboxPath,
        dropboxFileId: file.dropboxFileId,
        fileName: file.fileName,
        fileSize: file.fileSize,
        lastModified: file.lastModified,
        dropboxRevision: file.dropboxRevision,
        cadToPdfCacheUrl: file.cadToPdfCacheUrl,
        uploadedPdfUrl: file.uploadedPdfUrl,
        cacheExpiry: file.cacheExpiry,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      })),
      checklistItem: {
        id: checklistItem.id,
        name: checklistItem.name
      }
    })

  } catch (error) {
    console.error('Get linked files API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
