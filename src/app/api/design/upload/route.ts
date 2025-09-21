import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const sectionId = formData.get('sectionId') as string
    const userDescription = formData.get('description') as string | null

    if (!file || !sectionId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file and sectionId' 
      }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'application/pdf'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `File type not supported. Allowed types: ${allowedTypes.join(', ')}`
      }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        stage: {
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

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // For now, we'll store files locally/in memory. In production, this would use cloud storage
    // For the proof of concept, we'll create a mock URL
    const fileName = `${Date.now()}-${file.name}`
    const fileUrl = `/uploads/design/${fileName}` // Mock URL for now

    // Determine asset type
    let assetType: 'IMAGE' | 'PDF' | 'DOCUMENT' = 'DOCUMENT'
    if (file.type.startsWith('image/')) {
      assetType = 'IMAGE'
    } else if (file.type === 'application/pdf') {
      assetType = 'PDF'
    }

    // Create asset record
    const asset = await prisma.asset.create({
      data: withCreateAttribution(session, {
        title: file.name,
        filename: fileName,
        url: fileUrl,
        type: assetType,
        size: file.size,
        mimeType: file.type,
        provider: 'local',
        userDescription: userDescription || null,
        orgId: session.user.orgId,
        projectId: section.stage.room.project.id,
        roomId: section.stage.room.id,
        stageId: section.stage.id,
        sectionId: section.id,
        uploadedBy: session.user.id
      })
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.ASSET_UPLOADED,
      entity: EntityTypes.ASSET,
      entityId: asset.id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        sectionType: section.type,
        sectionName: section.type,
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name,
        hasDescription: !!userDescription
      },
      ipAddress
    })

    // Return asset with additional metadata
    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        title: asset.title,
        filename: asset.filename,
        url: asset.url,
        type: asset.type,
        size: asset.size,
        mimeType: asset.mimeType,
        userDescription: asset.userDescription,
        createdAt: asset.createdAt,
        uploadedBy: {
          id: session.user.id,
          name: session.user.name
        }
      }
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const sectionId = url.searchParams.get('sectionId')

    if (!sectionId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: sectionId' 
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Get all assets for this section
    const assets = await prisma.asset.findMany({
      where: {
        sectionId: sectionId
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assetTags: {
          include: {
            tag: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        assetPin: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        {
          assetPin: {
            createdAt: 'desc'
          }
        },
        {
          createdAt: 'desc'
        }
      ]
    })

    return NextResponse.json({
      success: true,
      assets: assets.map(asset => ({
        id: asset.id,
        title: asset.title,
        filename: asset.filename,
        url: asset.url,
        type: asset.type,
        size: asset.size,
        mimeType: asset.mimeType,
        userDescription: asset.userDescription,
        createdAt: asset.createdAt,
        uploadedBy: asset.uploader,
        tags: asset.assetTags.map(at => ({
          id: at.tag.id,
          name: at.tag.name,
          type: at.tag.type,
          color: at.tag.color,
          taggedBy: at.user
        })),
        pinnedBy: asset.assetPin ? asset.assetPin.user : null,
        isPinned: !!asset.assetPin
      }))
    })

  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const assetId = url.searchParams.get('assetId')

    if (!assetId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: assetId' 
      }, { status: 400 })
    }

    // Find the asset and verify user has access
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        orgId: session.user.orgId
      },
      include: {
        section: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete the asset (this will cascade to related records)
    await prisma.asset.delete({
      where: { id: assetId }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.ASSET_DELETED,
      entity: EntityTypes.ASSET,
      entityId: assetId,
      details: {
        fileName: asset.title,
        fileType: asset.type,
        sectionType: asset.section?.type,
        stageName: asset.section ? `${asset.section.stage.type} - ${asset.section.stage.room.name || asset.section.stage.room.type}` : undefined,
        projectName: asset.section?.stage.room.project.name
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting asset:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
