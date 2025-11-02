import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, generateFilePath, getContentType, isBlobConfigured } from '@/lib/blob'
import { dropboxService } from '@/lib/dropbox-service'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// Configure route to handle larger file uploads
export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

// Configure body parser for larger files (10MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

// POST /api/renderings/[versionId]/upload - Upload files to a rendering version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams

    // Verify rendering version access
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId
      },
      include: {
        room: {
          include: {
            project: true
          }
        },
        stage: true
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Get form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadedAssets = []
    
    // Process each file
    for (const file of files) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ 
          error: `Unsupported file type: ${file.type}. Allowed types: JPG, PNG, WebP, PDF` 
        }, { status: 400 })
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json({ 
          error: `File ${file.name} is too large. Maximum size is 10MB.` 
        }, { status: 400 })
      }

      try {
        // Generate unique filename
        const timestamp = Date.now()
        const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

        // Convert file to buffer once
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        let fileUrl: string
        let storageProvider: string
        
        // Upload to Dropbox as primary storage
        if (renderingVersion.room.project.dropboxFolder) {
          const roomName = renderingVersion.room.name || renderingVersion.room.type
          const sanitizedRoomName = roomName.replace(/[<>:"\/\\|?*]/g, '-').trim()
          const dropboxFolderPath = `${renderingVersion.room.project.dropboxFolder}/3-RENDERING/${sanitizedRoomName}/${renderingVersion.version}`
          
          // Ensure the folder exists
          try {
            await dropboxService.createFolder(dropboxFolderPath)
          } catch (folderError) {
            console.log('[Dropbox] Folder may already exist:', dropboxFolderPath)
          }
          
          // Upload to Dropbox
          const dropboxFilePath = `${dropboxFolderPath}/${filename}`
          await dropboxService.uploadFile(dropboxFilePath, buffer)
          
          fileUrl = dropboxFilePath
          storageProvider = 'dropbox'
          
          console.log(`✅ File uploaded to Dropbox: ${dropboxFilePath}`)
        } else {
          // Fallback: Project must have Dropbox integration
          throw new Error('Project does not have Dropbox integration enabled. Please configure Dropbox in project settings.')
        }

        // Determine asset type
        let assetType: 'IMAGE' | 'PDF' | 'RENDER' | 'DRAWING' | 'OTHER' = 'OTHER'
        if (file.type.startsWith('image/')) {
          assetType = 'RENDER'
        } else if (file.type === 'application/pdf') {
          assetType = 'PDF'
        }

        // Create asset record in database
        const asset = await prisma.asset.create({
          data: {
            title: file.name,
            filename: filename,
            url: fileUrl,
            type: assetType,
            size: file.size,
            mimeType: file.type,
            provider: storageProvider,
            metadata: JSON.stringify({
              originalName: file.name,
              uploadDate: new Date().toISOString(),
              uploadedToVersion: renderingVersion.version,
              storageMethod: 'dropbox',
              renderingWorkspace: true
            }),
            orgId: renderingVersion.room.project.orgId, // Use the actual organization ID from the project
            projectId: renderingVersion.room.project.id,
            roomId: renderingVersion.room.id,
            stageId: renderingVersion.stageId,
            renderingVersionId: versionId,
            uploadedBy: session.user.id
          }
        })

        uploadedAssets.push(asset)

        // Log activity for each file
        await logActivity({
          session,
          action: ActivityActions.ASSET_UPLOADED,
          entity: EntityTypes.ASSET,
          entityId: asset.id,
          details: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            version: renderingVersion.version,
            roomName: renderingVersion.room.name || renderingVersion.room.type,
            projectName: renderingVersion.room.project.name,
            message: `File "${file.name}" uploaded to ${renderingVersion.version}`
          },
          ipAddress
        })

      } catch (error) {
        console.error(`❌ Error uploading file ${file.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          versionId: versionId
        })
        return NextResponse.json({ 
          error: `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      uploadedAssets,
      message: `Successfully uploaded ${uploadedAssets.length} file(s)` 
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Fatal error uploading files to rendering version:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      versionId: resolvedParams?.versionId || 'unknown'
    })
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
}
