import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, generateFilePath, getContentType, isBlobConfigured } from '@/lib/blob'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

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
        id: versionId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
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
        
        console.log(`Processing rendering upload: ${filename} (${(file.size / 1024).toFixed(2)}KB)`)

        // Check if Vercel Blob is available (preferred) or fallback to database
        const useBlobStorage = isBlobConfigured()
        let fileUrl: string
        let storageProvider: string
        
        if (useBlobStorage) {
          // Upload to Vercel Blob storage
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          const filePath = generateFilePath(
            session.user.orgId,
            renderingVersion.room.project.id,
            renderingVersion.room.id,
            undefined, // no section for rendering files
            filename
          )
          
          const contentType = getContentType(filename)
          const blobResult = await uploadFile(buffer, filePath, {
            contentType,
            filename: filename
          })
          
          fileUrl = blobResult.url
          storageProvider = 'vercel-blob'
          console.log('✅ File uploaded to Vercel Blob:', blobResult.url)
        } else {
          // Fallback to database storage (development only)
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Blob storage not configured in production')
          }
          
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          const fileData = buffer.toString('base64')
          fileUrl = `data:${file.type};base64,${fileData}`
          storageProvider = 'database'
          console.log('⚠️ Using database storage (development fallback)')
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
          data: withCreateAttribution(session, {
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
              storageMethod: useBlobStorage ? 'vercel_blob' : 'postgres_base64',
              renderingWorkspace: true
            }),
            orgId: session.user.orgId,
            projectId: renderingVersion.room.project.id,
            roomId: renderingVersion.room.id,
            stageId: renderingVersion.stageId,
            renderingVersionId: versionId,
            uploader: {
              connect: {
                id: session.user.id
              }
            }
          })
        })
        })

        uploadedAssets.push(asset)

        console.log(`✅ File uploaded successfully to database: ${asset.id} (${assetType})`)

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
        console.error(`Error uploading file ${file.name}:`, error)
        return NextResponse.json({ 
          error: `Failed to process ${file.name}` 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      uploadedAssets,
      message: `Successfully uploaded ${uploadedAssets.length} file(s)` 
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading files to rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
