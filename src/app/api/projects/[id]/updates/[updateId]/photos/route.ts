import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
// import { uploadToS3, extractGPSFromImage, analyzeImageWithAI } from '@/lib/image-processing'

const photoUploadSchema = z.object({
  assetId: z.string(),
  caption: z.string().optional(),
  gpsCoordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  takenAt: z.string().datetime().optional(),
  beforeAfterPairId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  roomArea: z.string().optional(),
  tradeCategory: z.string().optional(),
  isBeforePhoto: z.boolean().default(false),
  isAfterPhoto: z.boolean().default(false),
  annotationsData: z.object({
    annotations: z.array(z.object({
      type: z.enum(['arrow', 'circle', 'rectangle', 'freehand', 'text']),
      coordinates: z.array(z.number()),
      color: z.string(),
      text: z.string().optional(),
      strokeWidth: z.number().optional()
    }))
  }).optional()
})

const photoUpdateSchema = z.object({
  caption: z.string().optional(),
  tags: z.array(z.string()).optional(),
  roomArea: z.string().optional(),
  tradeCategory: z.string().optional(),
  isBeforePhoto: z.boolean().optional(),
  isAfterPhoto: z.boolean().optional(),
  beforeAfterPairId: z.string().optional(),
  annotationsData: z.object({
    annotations: z.array(z.object({
      type: z.enum(['arrow', 'circle', 'rectangle', 'freehand', 'text']),
      coordinates: z.array(z.number()),
      color: z.string(),
      text: z.string().optional(),
      strokeWidth: z.number().optional()
    }))
  }).optional()
})

// GET /api/projects/[id]/updates/[updateId]/photos - Get all photos for an update
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params

    // Check if user has access to project and update
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Get photos with enhanced data
    const photos = await prisma.projectUpdatePhoto.findMany({
      where: {
        updateId
      },
      include: {
        asset: {
          select: {
            id: true,
            title: true,
            filename: true,
            url: true,
            type: true,
            size: true,
            mimeType: true,
            metadata: true,
            uploadedBy: true,
            uploader: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            createdAt: true
          }
        },
        beforeAfterPair: {
          include: {
            asset: {
              select: {
                id: true,
                title: true,
                url: true,
                type: true
              }
            }
          }
        },
        pairedPhoto: {
          include: {
            asset: {
              select: {
                id: true,
                title: true,
                url: true,
                type: true
              }
            }
          }
        }
      },
      orderBy: {
        takenAt: 'desc'
      }
    })

    // Group photos by categories and organize before/after pairs
    const response = {
      photos,
      stats: {
        total: photos.length,
        byTradeCategory: photos.reduce((acc, photo) => {
          if (photo.tradeCategory) {
            acc[photo.tradeCategory] = (acc[photo.tradeCategory] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>),
        byRoomArea: photos.reduce((acc, photo) => {
          if (photo.roomArea) {
            acc[photo.roomArea] = (acc[photo.roomArea] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>),
        beforeAfterPairs: photos.filter(p => p.beforeAfterPairId).length / 2,
        withAnnotations: photos.filter(p => p.annotationsData).length,
        withGPS: photos.filter(p => p.gpsCoordinates).length
      },
      beforeAfterPairs: photos
        .filter(p => p.isBeforePhoto && p.pairedPhoto)
        .map(before => ({
          before,
          after: before.pairedPhoto
        }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/updates/[updateId]/photos - Add photo to update
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = photoUploadSchema.parse(body)

    // Check if user has access to project and update
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Verify asset exists and user has access
    const asset = await prisma.asset.findFirst({
      where: {
        id: validatedData.assetId,
        type: 'IMAGE',
        OR: [
          { uploadedBy: session.user.id },
          { project: { organization: { users: { some: { id: session.user.id } } } } }
        ]
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Extract GPS data from image if not provided
    let gpsCoordinates = validatedData.gpsCoordinates
    if (!gpsCoordinates && asset.url) {
      try {
        // TODO: Implement GPS extraction from EXIF data
        // gpsCoordinates = await extractGPSFromImage(asset.url)
      } catch (error) {
        console.warn('Failed to extract GPS data:', error)
      }
    }

    // Auto-detect room area and trade category using AI
    let aiAnalysis = null
    let autoDetectedTags = validatedData.tags || []
    
    try {
      // TODO: Implement AI image analysis
      // aiAnalysis = await analyzeImageWithAI(asset.url)
      // 
      // if (aiAnalysis?.detectedObjects) {
      //   // Add AI-detected tags
      //   autoDetectedTags = [...autoDetectedTags, ...aiAnalysis.suggestedTags]
      // }
      
      // Mock AI analysis for demonstration
      aiAnalysis = {
        detectedObjects: ['electrical_outlet', 'wall', 'flooring'],
        suggestedTags: ['electrical', 'rough-in'],
        roomType: 'kitchen',
        tradeCategory: 'electrical',
        qualityScore: 0.85,
        issues: []
      }
    } catch (error) {
      console.warn('Failed to analyze image with AI:', error)
    }

    // Create photo record
    const photo = await prisma.projectUpdatePhoto.create({
      data: {
        updateId,
        assetId: validatedData.assetId,
        caption: validatedData.caption,
        gpsCoordinates: gpsCoordinates || validatedData.gpsCoordinates,
        takenAt: validatedData.takenAt ? new Date(validatedData.takenAt) : new Date(),
        beforeAfterPairId: validatedData.beforeAfterPairId,
        tags: autoDetectedTags,
        roomArea: validatedData.roomArea || aiAnalysis?.roomType,
        tradeCategory: validatedData.tradeCategory || aiAnalysis?.tradeCategory,
        isBeforePhoto: validatedData.isBeforePhoto,
        isAfterPhoto: validatedData.isAfterPhoto,
        annotationsData: validatedData.annotationsData,
        aiAnalysis
      },
      include: {
        asset: {
          select: {
            id: true,
            title: true,
            filename: true,
            url: true,
            type: true,
            size: true,
            mimeType: true,
            metadata: true
          }
        }
      }
    })

    // If this is an "after" photo, create before/after pair
    if (validatedData.isAfterPhoto && validatedData.beforeAfterPairId) {
      await prisma.projectUpdatePhoto.update({
        where: { id: validatedData.beforeAfterPairId },
        data: { beforeAfterPairId: photo.id }
      })
    }

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId,
        actorId: session.user.id,
        actionType: 'ADD_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photo.id,
        description: `Added photo${validatedData.caption ? `: ${validatedData.caption}` : ''}`,
        metadata: {
          photoId: photo.id,
          assetId: validatedData.assetId,
          tradeCategory: photo.tradeCategory,
          roomArea: photo.roomArea,
          aiAnalysis
        }
      }
    })

    // Update project update to show recent activity
    await prisma.projectUpdate.update({
      where: { id: updateId },
      data: { updatedAt: new Date() }
    })

    // Generate thumbnail and optimized versions
    // TODO: Implement background job for image processing
    // await generateImageVariants(asset.url, asset.id)

    // Revalidate pages
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket
    // TODO: Send notifications to relevant stakeholders

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('Error adding photo:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to add photo' },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id]/updates/[updateId]/photos/[photoId] - Update photo metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string; photoId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId, photoId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = photoUpdateSchema.parse(body)

    // Check if user has access to project and photo
    const photo = await prisma.projectUpdatePhoto.findFirst({
      where: {
        id: photoId,
        updateId,
        update: {
          projectId,
          project: {
            OR: [
              { createdById: session.user.id },
              { updatedById: session.user.id },
              { organization: { users: { some: { id: session.user.id } } } }
            ]
          }
        }
      }
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Update photo
    const updatedPhoto = await prisma.projectUpdatePhoto.update({
      where: { id: photoId },
      data: validatedData,
      include: {
        asset: {
          select: {
            id: true,
            title: true,
            filename: true,
            url: true,
            type: true,
            size: true,
            mimeType: true
          }
        }
      }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId,
        actorId: session.user.id,
        actionType: 'UPDATE_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photoId,
        description: 'Updated photo metadata',
        metadata: {
          photoId,
          changes: validatedData
        }
      }
    })

    // Revalidate pages
    revalidatePath(`/projects/${projectId}/project-updates`)

    return NextResponse.json(updatedPhoto)
  } catch (error) {
    console.error('Error updating photo:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/updates/[updateId]/photos/[photoId] - Remove photo from update
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string; photoId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId, photoId } = await params

    // Check if user has access to project and photo
    const photo = await prisma.projectUpdatePhoto.findFirst({
      where: {
        id: photoId,
        updateId,
        update: {
          projectId,
          project: {
            OR: [
              { createdById: session.user.id },
              { updatedById: session.user.id },
              { organization: { users: { some: { id: session.user.id } } } }
            ]
          }
        }
      }
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Remove photo
    await prisma.projectUpdatePhoto.delete({
      where: { id: photoId }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId,
        actorId: session.user.id,
        actionType: 'REMOVE_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photoId,
        description: `Removed photo${photo.caption ? `: ${photo.caption}` : ''}`,
        metadata: {
          photoId,
          assetId: photo.assetId
        }
      }
    })

    // Revalidate pages
    revalidatePath(`/projects/${projectId}/project-updates`)

    return NextResponse.json({ message: 'Photo removed successfully' })
  } catch (error) {
    console.error('Error removing photo:', error)
    return NextResponse.json(
      { error: 'Failed to remove photo' },
      { status: 500 }
    )
  }
}