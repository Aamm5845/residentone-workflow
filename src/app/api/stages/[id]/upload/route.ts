import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { uploadToDropbox, createFolderStructure } from '@/lib/dropbox'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Local storage upload function
async function uploadToLocal(buffer: Buffer, fileName: string, stageId: string) {
  // Create organized local folder structure
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'stages', stageId)
  
  try {
    await mkdir(uploadDir, { recursive: true })
  } catch (error) {
    // Directory might already exist, ignore error
  }

  // Write file to disk
  const filePath = join(uploadDir, fileName)
  await writeFile(filePath, buffer)
  
  return {
    url: `/uploads/stages/${stageId}/${fileName}`,
    provider: 'local',
    metadata: JSON.stringify({
      localPath: filePath,
      uploadDate: new Date().toISOString()
    })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get orgId with fallback
    const orgId = (session.user as any)?.orgId || 'default'

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sectionId = formData.get('sectionId') as string

    if (!file || !sectionId) {
      return NextResponse.json({ error: 'File and sectionId are required' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large', 
        details: `File size must be less than ${maxSize / (1024 * 1024)}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
      }, { status: 413 })
    }

    if (file.size === 0) {
      return NextResponse.json({ 
        error: 'Empty file', 
        details: 'Cannot upload empty file'
      }, { status: 400 })
    }

    // Find the stage and verify access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: orgId
          }
        }
      },
      include: {
        designSections: true,
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Find or create design section
    let designSection = stage.designSections?.find(section => section.type === sectionId)
    
    if (!designSection) {
      designSection = await prisma.designSection.create({
        data: {
          stageId: stage.id,
          type: sectionId as any,
          content: ''
        }
      })
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    // Try Dropbox first, fall back to local storage if it fails
    let fileUrl: string
    let provider: string
    let metadata: string | null = null

    // Check if Dropbox is configured
    const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN
    if (dropboxToken && dropboxToken !== 'your-dropbox-access-token-here') {
      try {
        // Create upload context for organized Dropbox folder structure
        const uploadContext = {
          orgId: orgId,
          projectId: stage.room.project.id,
          projectName: stage.room.project.name,
          roomId: stage.room.id,
          roomName: stage.room.name || stage.room.type,
          stageType: stage.type,
          sectionType: sectionId
        }

        // Ensure folder structure exists in Dropbox
        await createFolderStructure(uploadContext)

        // Upload file to Dropbox
        const dropboxResult = await uploadToDropbox(buffer, fileName, uploadContext)
        fileUrl = dropboxResult.url
        provider = 'dropbox'
        metadata = JSON.stringify({
          dropboxPath: dropboxResult.path,
          uploadContext: uploadContext
        })
        
        console.log('File uploaded to Dropbox successfully')
      } catch (dropboxError) {
        console.error('Dropbox upload failed, details:', {
          error: dropboxError instanceof Error ? dropboxError.message : String(dropboxError),
          fileName: fileName,
          stageId: resolvedParams.id,
          timestamp: new Date().toISOString()
        })
        console.warn('Falling back to local storage')
        // Fall back to local storage
        const result = await uploadToLocal(buffer, fileName, resolvedParams.id)
        fileUrl = result.url
        provider = result.provider
        metadata = result.metadata
      }
    } else {
      console.log('Dropbox not configured, using local storage')
      // Use local storage
      const result = await uploadToLocal(buffer, fileName, resolvedParams.id)
      fileUrl = result.url
      provider = result.provider
      metadata = result.metadata
    }

    // Determine asset type - for THREE_D stage, mark as RENDER
    let assetType = 'DOCUMENT'
    if (stage.type === 'THREE_D') {
      assetType = 'RENDER'
    } else if (file.type.startsWith('image/')) {
      assetType = 'IMAGE'
    } else if (file.type === 'application/pdf') {
      assetType = 'PDF'
    }

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        title: file.name,
        filename: fileName,
        url: fileUrl,
        type: assetType as any,
        size: file.size,
        mimeType: file.type,
        provider: provider as any,
        metadata: metadata,
        uploadedBy: (session.user as any)?.id || 'unknown',
        orgId: orgId,
        projectId: stage.room.project.id,
        roomId: stage.room.id,
        stageId: stage.id,
        sectionId: designSection.id
      }
    })

    // If this is a THREE_D stage upload, create or update Client Approval version
    if (stage.type === 'THREE_D' && assetType === 'RENDER') {
      // Find CLIENT_APPROVAL stage for this room
      const clientApprovalStage = await prisma.stage.findFirst({
        where: {
          roomId: stage.roomId,
          type: 'CLIENT_APPROVAL'
        }
      })

      if (clientApprovalStage) {
        // Check if v1 already exists
        let clientApprovalVersion = await prisma.clientApprovalVersion.findFirst({
          where: {
            stageId: clientApprovalStage.id,
            version: 'v1'
          }
        })

        // Create v1 if it doesn't exist
        if (!clientApprovalVersion) {
          clientApprovalVersion = await prisma.clientApprovalVersion.create({
            data: {
              stageId: clientApprovalStage.id,
              version: 'v1',
              status: 'DRAFT',
              approvedByAaron: false,
              clientDecision: 'PENDING'
            }
          })

          // Create activity log
          await prisma.clientApprovalActivity.create({
            data: {
              versionId: clientApprovalVersion.id,
              type: 'version_created',
              message: 'Version v1 created from 3D rendering uploads',
              userId: (session.user as any)?.id || null
            }
          })
        }

        // Link the asset to the client approval version
        await prisma.clientApprovalAsset.create({
          data: {
            versionId: clientApprovalVersion.id,
            assetId: asset.id,
            includeInEmail: true, // Default to include new uploads
            displayOrder: 0
          }
        })
      }
    }

    // Get updated stage with all data
    const updatedStage = await prisma.stage.findUnique({
      where: { id: stage.id },
      include: {
        assignedUser: {
          select: { name: true }
        },
        designSections: {
          include: {
            assets: {
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      asset: asset,
      stage: updatedStage
    })

  } catch (error) {
    console.error('Upload error details:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      stageId: resolvedParams?.id,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
