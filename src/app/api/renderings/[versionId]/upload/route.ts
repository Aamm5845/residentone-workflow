import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToDropbox } from '@/lib/cloud-storage'
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
        // Generate Dropbox path: /projects/{projectId}/rooms/{roomId}/renderings/{version}/{filename}
        const projectId = renderingVersion.room.project.id
        const roomId = renderingVersion.room.id
        const version = renderingVersion.version.toLowerCase()
        const timestamp = Date.now()
        const fileExtension = file.name.split('.').pop()
        const filename = `${timestamp}-${file.name}`
        const dropboxPath = `/projects/${projectId}/rooms/${roomId}/renderings/${version}/${filename}`

        // Upload to Dropbox
        const uploadResult = await uploadToDropbox(file, dropboxPath)
        
        if (!uploadResult.success) {
          console.error('Dropbox upload failed:', uploadResult.error)
          return NextResponse.json({ 
            error: `Failed to upload ${file.name}: ${uploadResult.error}` 
          }, { status: 500 })
        }

        // Determine asset type
        let assetType = 'OTHER'
        if (file.type.startsWith('image/')) {
          assetType = 'RENDER'
        } else if (file.type === 'application/pdf') {
          assetType = 'PDF'
        }

        // Create asset record
        const asset = await prisma.asset.create({
          data: withCreateAttribution(session, {
            title: file.name,
            filename: file.name,
            url: uploadResult.url,
            type: assetType,
            size: file.size,
            mimeType: file.type,
            provider: 'dropbox',
            metadata: JSON.stringify({
              dropboxPath,
              originalName: file.name,
              uploadedToVersion: renderingVersion.version
            }),
            orgId: session.user.orgId,
            projectId: renderingVersion.room.project.id,
            roomId: renderingVersion.room.id,
            stageId: renderingVersion.stageId,
            renderingVersionId: versionId
          })
        })

        uploadedAssets.push(asset)

        // Log activity for each file
        await logActivity({
          session,
          action: ActivityActions.CREATE,
          entity: 'RENDERING_FILE',
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