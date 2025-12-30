import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity, ActivityActions, EntityTypes, getIPAddress } from '@/lib/attribution'

/**
 * Save a blob-uploaded photo to the database
 * This is called AFTER the client uploads directly to Vercel Blob
 */
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
    const body = await req.json()
    const {
      blobUrl,
      filename,
      size,
      mimeType,
      caption = '',
      notes = '',
      tags = [],
      roomId = null,
      customArea = '',
      tradeCategory = null,
      gpsCoordinates = null,
      takenAt = new Date().toISOString()
    } = body

    if (!blobUrl) {
      return NextResponse.json({ error: 'Blob URL is required' }, { status: 400 })
    }

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
        orgId: true,
        dropboxFolder: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Verify update exists
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId: project.id
      }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Determine asset type
    const isVideo = mimeType?.startsWith('video/') || false
    const assetType = isVideo ? 'OTHER' : mimeType === 'application/pdf' ? 'PDF' : 'IMAGE'

    // Create Asset record
    const asset = await prisma.asset.create({
      data: {
        title: filename || 'Uploaded file',
        filename: filename || 'unknown',
        url: blobUrl,
        type: assetType,
        size: size || 0,
        mimeType: mimeType || 'application/octet-stream',
        provider: 'vercel-blob',
        projectId: project.id,
        orgId: project.orgId,
        uploadedBy: session.user.id,
        metadata: JSON.stringify({
          originalName: filename,
          uploadedAt: new Date().toISOString(),
          notes: notes,
          storage: 'vercel-blob'
        })
      }
    })

    // Determine room area
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

    // Create ProjectUpdatePhoto record
    const photo = await prisma.projectUpdatePhoto.create({
      data: {
        updateId: update.id,
        assetId: asset.id,
        caption: caption || null,
        tags: tags,
        roomArea: roomArea || null,
        tradeCategory: tradeCategory || null,
        gpsCoordinates: gpsCoordinates,
        takenAt: new Date(takenAt),
        isBeforePhoto: tags.includes('before'),
        isAfterPhoto: tags.includes('after')
      }
    })

    // Log activity
    await prisma.projectUpdateActivity.create({
      data: {
        projectId: project.id,
        updateId: update.id,
        actorId: session.user.id,
        actionType: 'ADD_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photo.id,
        description: `Added photo${roomArea ? ` in ${roomArea}` : ''}`,
        metadata: {
          photoId: photo.id,
          assetId: asset.id,
          fileName: filename,
          fileSize: size,
          roomArea: roomArea || undefined,
          tradeCategory: tradeCategory || undefined,
          storage: 'vercel-blob'
        }
      }
    })

    // Log to main ActivityLog
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
        fileName: filename,
        fileSize: size,
        roomArea: roomArea || undefined,
        storage: 'vercel-blob'
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
    console.error('[BlobPhoto] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save photo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
