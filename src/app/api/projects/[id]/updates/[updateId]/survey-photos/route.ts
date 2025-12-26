import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { logActivity, ActivityActions, EntityTypes, getIPAddress } from '@/lib/attribution'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      },
      select: {
        id: true,
        name: true,
        dropboxFolder: true,
        orgId: true,
        client: {
          select: {
            name: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify update exists and belongs to project
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId: project.id
      }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const caption = formData.get('caption') as string || ''
    const notes = formData.get('notes') as string || ''

    // Determine media type (image/video)
    const isVideo = file?.type?.startsWith('video/') || false
    const tagsJson = formData.get('tags') as string
    const roomId = formData.get('roomId') as string | null
    const customArea = formData.get('customArea') as string || ''
    const tradeCategory = formData.get('tradeCategory') as string | null
    const gpsCoordinatesJson = formData.get('gpsCoordinates') as string | null
    const takenAtStr = formData.get('takenAt') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Parse JSON fields
    const tags: string[] = tagsJson ? JSON.parse(tagsJson) : []
    const gpsCoordinates = gpsCoordinatesJson ? JSON.parse(gpsCoordinatesJson) : null
    const takenAt = takenAtStr ? new Date(takenAtStr) : new Date()

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    let dropboxPath: string | null = null

    // Upload to Dropbox if configured and project has dropbox folder
    if (dropboxService.isConfigured() && project.dropboxFolder) {
      try {
        console.log('[SurveyPhotos] Uploading to Dropbox...')
        const result = await dropboxService.uploadSurveyPhoto(
          project.dropboxFolder,
          takenAt,
          fileBuffer,
          file.name
        )
        dropboxPath = result.path
        console.log('[SurveyPhotos] Uploaded to Dropbox:', dropboxPath)
      } catch (error) {
        console.error('[SurveyPhotos] Dropbox upload failed:', error)
        // Continue even if Dropbox upload fails - we'll still create the database record
      }
    }

    // Create Asset record (store videos as OTHER since AssetType lacks VIDEO)
    const asset = await prisma.asset.create({
      data: {
        title: file.name,
        filename: file.name,
        url: dropboxPath || '', // Use Dropbox path or empty string if failed
        type: isVideo ? 'OTHER' : 'IMAGE',
        size: file.size,
        mimeType: file.type,
        projectId: project.id,
        orgId: project.orgId,
        uploadedBy: session.user.id,
        metadata: JSON.stringify({
          dropboxPath: dropboxPath,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          notes: notes
        })
      }
    })

    // Determine room area - prefer room name from database, fallback to custom area
    let roomArea = customArea
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { name: true }
      })
      if (room) {
        roomArea = room.name
      }
    }

    // Create ProjectUpdatePhoto record (used for both images and videos)
    const photo = await prisma.projectUpdatePhoto.create({
      data: {
        updateId: update.id,
        assetId: asset.id,
        caption: caption || null,
        tags: tags,
        roomArea: roomArea || null,
        tradeCategory: tradeCategory || null,
        gpsCoordinates: gpsCoordinates,
        takenAt: takenAt,
        isBeforePhoto: tags.includes('before'),
        isAfterPhoto: tags.includes('after')
      }
    })

    console.log('[SurveyPhotos] Photo record created:', photo.id)

    // Log activity to ProjectUpdateActivity
    await prisma.projectUpdateActivity.create({
      data: {
        projectId: project.id,
        updateId: update.id,
        actorId: session.user.id,
        actionType: 'ADD_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photo.id,
        description: `Added survey photo${roomArea ? ` in ${roomArea}` : ''}`,
        metadata: {
          photoId: photo.id,
          assetId: asset.id,
          fileName: file.name,
          fileSize: file.size,
          roomArea: roomArea || undefined,
          tradeCategory: tradeCategory || undefined,
          dropboxPath: dropboxPath || undefined
        }
      }
    })

    // Log to main ActivityLog so it shows in Activities page
    const ipAddress = getIPAddress(req)
    await logActivity({
      session,
      action: ActivityActions.PROJECT_UPDATE_PHOTO_ADDED,
      entity: EntityTypes.PROJECT_UPDATE_PHOTO,
      entityId: photo.id,
      details: {
        projectId: project.id,
        projectName: project.name,
        updateId: update.id,
        photoId: photo.id,
        assetId: asset.id,
        fileName: file.name,
        fileSize: file.size,
        roomArea: roomArea || undefined,
        tradeCategory: tradeCategory || undefined,
        dropboxPath: dropboxPath || undefined,
        isSurveyPhoto: true
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        assetId: asset.id,
        caption: photo.caption,
        tags: photo.tags,
        roomArea: photo.roomArea,
        tradeCategory: photo.tradeCategory,
        dropboxPath: dropboxPath,
        asset: {
          id: asset.id,
          title: asset.title,
          url: asset.url,
          type: asset.type,
          size: asset.size
        }
      }
    })

  } catch (error) {
    console.error('[SurveyPhotos] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload photo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
