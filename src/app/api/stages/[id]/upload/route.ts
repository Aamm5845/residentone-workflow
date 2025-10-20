import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

/**
 * FILE STORAGE IMPLEMENTATION NOTES:
 * 
 * CURRENT (v1): Database Storage
 * - Files are stored as base64 encoded strings in Postgres
 * - Works perfectly in Vercel serverless environment
 * - No external dependencies or API keys required
 * - Suitable for moderate file sizes and volume
 * 
 * PLANNED (v2): Dropbox Integration
 * - Will use Dropbox API for file storage
 * - Better for larger files and higher volume
 * - Requires Dropbox API setup and credentials
 * - Will fall back to database storage if Dropbox fails
 * 
 * For future developers: The Dropbox integration code has been removed
 * to avoid confusion. When ready to implement, refer to:
 * - @/lib/dropbox (needs to be created)
 * - DROPBOX_ACCESS_TOKEN environment variable
 * - Dropbox folder structure planning
 */

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
    
    // Get shared organization
    const sharedOrg = await prisma.organization.findFirst()
    if (!sharedOrg) {
      return NextResponse.json({ error: 'No shared organization found' }, { status: 500 })
    }

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

    // Find the stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
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

    // Store file data directly in database as base64
    // This works in Vercel serverless environment
    const fileData = buffer.toString('base64')
    const fileUrl = `data:${file.type};base64,${fileData}`
    const provider = 'database'
    const metadata = JSON.stringify({
      originalName: file.name,
      uploadDate: new Date().toISOString(),
      stageId: resolvedParams.id,
      sectionType: sectionId,
      storageMethod: 'postgres_base64'
    })

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
        projectId: stage.room.project.id,
        roomId: stage.room.id,
        stageId: stage.id,
        sectionId: designSection.id,
        uploadedBy: (session.user as any)?.id || 'unknown',
        orgId: sharedOrg.id
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
