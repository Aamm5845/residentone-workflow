import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
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
      console.error('❌ Unauthorized - invalid session')
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
      'application/pdf',
      'font/ttf',
      'font/otf',
      'application/x-font-ttf',
      'application/x-font-otf',
      'font/woff',
      'font/woff2'
    ]
    
    // Also check by file extension for fonts (browsers may report different MIME types)
    const fileNameLower = file.name.toLowerCase()
    const isFontFile = fileNameLower.endsWith('.ttf') || fileNameLower.endsWith('.otf') || 
                       fileNameLower.endsWith('.woff') || fileNameLower.endsWith('.woff2')
    
    if (!allowedTypes.includes(file.type) && !isFontFile) {
      return NextResponse.json({
        error: `File type not supported. Allowed types: Images (JPG, PNG, WebP), PDF, Fonts (TTF, OTF, WOFF, WOFF2)`
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
      console.error('❌ Section not found:', { sectionId, userId: session.user.id, orgId: session.user.orgId })
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Upload to Dropbox in organized folder structure
    const buffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    let fileUrl: string
    let provider: string
    
    // Check if project has Dropbox integration
    if (section.stage.room.project.dropboxFolder) {
      const roomName = section.stage.room.name || section.stage.room.type
      const sanitizedRoomName = roomName.replace(/[<>:"\/\\|?*]/g, '-').trim()
      
      // Create path: /Project/7- SOURCES/Design Concept/{RoomName}/
      const dropboxFolderPath = `${section.stage.room.project.dropboxFolder}/7- SOURCES/Design Concept/${sanitizedRoomName}`
      
      // Ensure the folder exists
      try {
        console.log('[Dropbox] Creating folder structure...', dropboxFolderPath)
        await dropboxService.createFolder(`${section.stage.room.project.dropboxFolder}/7- SOURCES`)
        await dropboxService.createFolder(`${section.stage.room.project.dropboxFolder}/7- SOURCES/Design Concept`)
        await dropboxService.createFolder(dropboxFolderPath)
        console.log('[Dropbox] ✅ Folder structure created successfully')
      } catch (folderError) {
        console.log('[Dropbox] Folders may already exist or error occurred:', folderError)
        // Continue anyway - folders might already exist
      }
      
      // Upload to Dropbox
      const dropboxFilePath = `${dropboxFolderPath}/${fileName}`
      await dropboxService.uploadFile(dropboxFilePath, buffer)
      
      fileUrl = dropboxFilePath
      provider = 'dropbox'
      
      console.log(`✅ Design image uploaded to Dropbox: ${dropboxFilePath}`)
    } else {
      // Fallback to database storage if no Dropbox integration
      const fileData = buffer.toString('base64')
      fileUrl = `data:${file.type};base64,${fileData}`
      provider = 'database'
      console.log('⚠️ No Dropbox integration - falling back to database storage')
    }
    
    const metadata = JSON.stringify({
      originalName: file.name,
      uploadDate: new Date().toISOString(),
      stageId: section.stageId,
      sectionType: section.type,
      storageMethod: provider === 'dropbox' ? 'dropbox' : 'postgres_base64'
    })

    // Determine asset type
    let assetType: 'IMAGE' | 'PDF' | 'DOCUMENT' = 'DOCUMENT'
    if (file.type.startsWith('image/')) {
      assetType = 'IMAGE'
    } else if (file.type === 'application/pdf') {
      assetType = 'PDF'
    }

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        title: file.name,
        filename: fileName,
        url: fileUrl,
        type: assetType,
        size: file.size,
        mimeType: file.type,
        provider: provider,
        metadata: metadata,
        userDescription: userDescription || null,
        uploadedBy: session.user.id,
        orgId: session.user.orgId,
        projectId: section.stage.room.project.id,
        roomId: section.stage.room.id,
        stageId: section.stage.id,
        sectionId: section.id
      }
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
    console.error('❌ Upload API Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
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
        uploadedByUser: {
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
        uploadedBy: asset.uploadedByUser,
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

    // Attempt to delete the actual file from storage
    try {
      if (asset.provider === 'dropbox' && asset.url.startsWith('/')) {
        // Delete from Dropbox
        await dropboxService.deleteFile(asset.url)
        console.log(`✅ Deleted file from Dropbox: ${asset.url}`)
      }
    } catch (fileDeleteError) {
      console.error('⚠️ Error deleting file from storage:', fileDeleteError)
      // Continue with database deletion even if file deletion fails
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
