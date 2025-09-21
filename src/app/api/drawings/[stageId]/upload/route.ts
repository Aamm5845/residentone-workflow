import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

// POST /api/drawings/{stageId}/upload
// Upload files to drawings workspace and link to checklist category
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = params
    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
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
    })

    if (!stage || stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Stage not found or access denied' }, { status: 404 })
    }

    // Ensure this is a DRAWINGS stage
    if (stage.type !== 'DRAWINGS') {
      return NextResponse.json({ error: 'Invalid stage type for drawings workspace' }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const checklistItemId = formData.get('checklistItemId') as string

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (!checklistItemId) {
      return NextResponse.json({ error: 'Checklist item ID is required' }, { status: 400 })
    }

    // Verify checklist item belongs to this stage
    const checklistItem = await prisma.drawingChecklistItem.findUnique({
      where: { id: checklistItemId }
    })

    if (!checklistItem || checklistItem.stageId !== stageId) {
      return NextResponse.json({ error: 'Invalid checklist item' }, { status: 400 })
    }

    const uploadedAssets = []

    for (const file of files) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/acad', // DWG
        'application/dwg',
        'image/vnd.dwg',
        'application/x-dwg'
      ]

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ 
          error: `File type not supported: ${file.type}. Allowed types: PDF, JPG, PNG, WebP, DWG` 
        }, { status: 400 })
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ 
          error: `File too large: ${file.name}. Maximum size is 10MB` 
        }, { status: 400 })
      }

      try {
        // Upload to Vercel Blob storage
        const blob = await put(`drawings/${stageId}/${Date.now()}-${file.name}`, file, {
          access: 'public'
        })

        // Determine asset type
        let assetType = 'DRAWING'
        if (file.type.startsWith('image/')) {
          assetType = 'IMAGE'
        } else if (file.type === 'application/pdf') {
          assetType = 'PDF'
        }

        // Create asset record
        const asset = await prisma.asset.create({
          data: {
            title: file.name,
            filename: file.name,
            url: blob.url,
            type: assetType as any,
            size: file.size,
            mimeType: file.type,
            provider: 'vercel-blob',
            uploadedBy: session.user.id,
            orgId: session.user.orgId!,
            projectId: stage.room.projectId,
            roomId: stage.roomId,
            stageId: stageId,
            drawingChecklistItemId: checklistItemId
          },
          include: {
            uploader: {
              select: { id: true, name: true, email: true }
            }
          }
        })

        uploadedAssets.push(asset)

        // Log upload activity
        await prisma.activityLog.create({
          data: {
            actorId: session.user.id,
            action: 'UPLOAD_DRAWING',
            entity: 'STAGE',
            entityId: stageId,
            details: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              checklistItem: checklistItem.name,
              assetId: asset.id
            },
            orgId: session.user.orgId
          }
        })

      } catch (uploadError) {
        console.error('Error uploading file:', uploadError)
        return NextResponse.json({ 
          error: `Failed to upload file: ${file.name}` 
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      assets: uploadedAssets,
      message: `Successfully uploaded ${uploadedAssets.length} file(s)`
    })

  } catch (error) {
    console.error('Error uploading drawings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}