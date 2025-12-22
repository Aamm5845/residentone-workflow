import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'
import { isBlobConfigured } from '@/lib/blob'

const ALLOWED_FILE_TYPES = {
  'application/pdf': { extension: '.pdf', assetType: 'FLOORPLAN_PDF' as const },
  'application/dwg': { extension: '.dwg', assetType: 'FLOORPLAN_CAD' as const },
  'application/dxf': { extension: '.dxf', assetType: 'FLOORPLAN_CAD' as const },
  'application/acad': { extension: '.dwg', assetType: 'FLOORPLAN_CAD' as const },
  'image/vnd.dwg': { extension: '.dwg', assetType: 'FLOORPLAN_CAD' as const },
  // Handle cases where browser doesn't recognize the MIME type
  'application/octet-stream': { extension: '.pdf', assetType: 'FLOORPLAN_PDF' as const }
}

// Increase limit to 100MB for large multi-page PDFs
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      },
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const versionId = formData.get('versionId') as string
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided' 
      }, { status: 400 })
    }

    if (!versionId) {
      return NextResponse.json({ 
        error: 'Version ID is required' 
      }, { status: 400 })
    }

    // Validate file type - check by extension if MIME type is not recognized
    let fileConfig = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]
    
    // Fallback: check file extension if MIME type is not in our list
    if (!fileConfig) {
      const extension = file.name.toLowerCase().split('.').pop()
      if (extension === 'pdf') {
        fileConfig = { extension: '.pdf', assetType: 'FLOORPLAN_PDF' as const }
      } else if (extension === 'dwg') {
        fileConfig = { extension: '.dwg', assetType: 'FLOORPLAN_CAD' as const }
      } else if (extension === 'dxf') {
        fileConfig = { extension: '.dxf', assetType: 'FLOORPLAN_CAD' as const }
      }
    }
    
    if (!fileConfig) {
      return NextResponse.json({
        error: 'Invalid file type',
        details: `Supported types: PDF, DWG, DXF. Received: ${file.type} (${file.name})`
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File too large',
        details: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
      }, { status: 413 })
    }

    if (file.size === 0) {
      return NextResponse.json({
        error: 'Empty file cannot be uploaded'
      }, { status: 400 })
    }

    // Verify the version exists and belongs to this project
    const version = await prisma.floorplanApprovalVersion.findFirst({
      where: {
        id: versionId,
        projectId: resolvedParams.id
      }
    })

    if (!version) {
      return NextResponse.json({ 
        error: 'Floorplan approval version not found' 
      }, { status: 404 })
    }

    // Process file for storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    let fileUrl: string
    let storageMethod = 'vercel_blob'
    
    // Try Vercel Blob first (primary storage for large files)
    if (isBlobConfigured()) {
      try {
        console.log('[Floorplan-Assets] Uploading to Vercel Blob...')
        const blobPath = `floorplan-approvals/${resolvedParams.id}/${versionId}/${fileName}`
        const blobResult = await put(blobPath, buffer, {
          access: 'public',
          contentType: file.type || 'application/pdf',
        })
        fileUrl = blobResult.url
        console.log('[Floorplan-Assets] ✅ Uploaded to Vercel Blob:', fileUrl)
      } catch (blobError) {
        console.error('[Floorplan-Assets] ⚠️ Vercel Blob failed, falling back to database:', blobError)
        // Fallback to base64 if blob fails
        const fileData = buffer.toString('base64')
        fileUrl = `data:${file.type};base64,${fileData}`
        storageMethod = 'postgres_base64'
      }
    } else {
      // No Vercel Blob configured - use database storage
      console.log('[Floorplan-Assets] Vercel Blob not configured, using database storage')
      const fileData = buffer.toString('base64')
      fileUrl = `data:${file.type};base64,${fileData}`
      storageMethod = 'postgres_base64'
    }
    
    // Mirror to Dropbox (archival/backup - non-fatal if fails)
    let dropboxUrl: string | undefined
    let dropboxPath: string | undefined
    
    if (project.dropboxFolder) {
      try {
        console.log('[Floorplan-Assets] Mirroring to Dropbox...')
        const { DropboxService } = await import('@/lib/dropbox-service')
        const dropboxService = new DropboxService()
        
        // Ensure folder structure
        const basePath = `${project.dropboxFolder}/11- SOFTWARE UPLOADS`
        const floorplanPath = `${basePath}/Floorplan Approvals`
        
        try {
          await dropboxService.createFolder(basePath)
          await dropboxService.createFolder(floorplanPath)
        } catch (folderError) {
          console.log('[Floorplan-Assets] Dropbox folders already exist')
        }
        
        // Upload to Dropbox
        dropboxPath = `${floorplanPath}/${fileName}`
        await dropboxService.uploadFile(dropboxPath, buffer)
        
        // Get shared link
        const sharedLink = await dropboxService.createSharedLink(dropboxPath)
        if (sharedLink) {
          dropboxUrl = sharedLink
          console.log('[Floorplan-Assets] ✅ Asset mirrored to Dropbox:', dropboxPath)
        }
      } catch (dropboxError) {
        console.error('[Floorplan-Assets] ⚠️ Failed to mirror to Dropbox (non-fatal):', dropboxError)
        // Don't fail the upload - Vercel Blob is the primary storage
      }
    }
    
    const metadata = JSON.stringify({
      originalName: file.name,
      uploadDate: new Date().toISOString(),
      projectId: resolvedParams.id,
      versionId: versionId,
      storageMethod: storageMethod,
      category: fileConfig.assetType,
      dropboxUrl: dropboxUrl || null,
      dropboxPath: dropboxPath || null
    })

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        title: file.name,
        filename: fileName,
        url: fileUrl,
        type: fileConfig.assetType,
        size: file.size,
        mimeType: file.type || 'application/pdf',
        provider: storageMethod === 'vercel_blob' ? 'vercel_blob' : 'database',
        metadata: metadata,
        description: description || null,
        userDescription: description || null,
        uploadedBy: session.user.id,
        orgId: session.user.orgId,
        projectId: resolvedParams.id
      }
    })

    // Link asset to floorplan approval version
    const approvalAsset = await prisma.floorplanApprovalAsset.create({
      data: {
        versionId: versionId,
        assetId: asset.id,
        includeInEmail: true,
        displayOrder: 0
      }
    })

    // Create activity log for floorplan approval
    await prisma.floorplanApprovalActivity.create({
      data: {
        versionId: versionId,
        type: 'asset_uploaded',
        message: `${fileConfig.assetType === 'FLOORPLAN_PDF' ? 'PDF floorplan' : 'CAD file'} uploaded: ${file.name}`,
        userId: session.user.id,
        metadata: JSON.stringify({
          assetId: asset.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      }
    })

    // Log the activity in the main activity log
    await logActivity({
      session,
      action: ActivityActions.ASSET_UPLOADED,
      entity: EntityTypes.ASSET,
      entityId: asset.id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        assetType: fileConfig.assetType,
        projectName: project.name,
        clientName: project.client?.name,
        versionId: versionId,
        category: 'floorplan_approval'
      },
      ipAddress
    })

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
        description: asset.description,
        createdAt: asset.createdAt,
        uploadedBy: {
          id: session.user.id,
          name: session.user.name || 'Unknown User'
        }
      },
      approvalAsset: {
        id: approvalAsset.id,
        includeInEmail: approvalAsset.includeInEmail,
        displayOrder: approvalAsset.displayOrder
      }
    })

  } catch (error) {
    console.error('Floorplan asset upload error:', error)
    return NextResponse.json({
      error: 'Failed to upload floorplan asset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const versionId = url.searchParams.get('versionId')

    if (!versionId) {
      return NextResponse.json({ 
        error: 'Version ID is required' 
      }, { status: 400 })
    }

    // Get all assets for this floorplan approval version
    const approvalAssets = await prisma.floorplanApprovalAsset.findMany({
      where: {
        versionId: versionId,
        version: {
          projectId: resolvedParams.id
        }
      },
      include: {
        asset: {
          include: {
            uploadedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      assets: approvalAssets.map(aa => ({
        approvalAssetId: aa.id,
        includeInEmail: aa.includeInEmail,
        displayOrder: aa.displayOrder,
        asset: {
          id: aa.asset.id,
          title: aa.asset.title,
          filename: aa.asset.filename,
          url: aa.asset.url,
          type: aa.asset.type,
          size: aa.asset.size,
          mimeType: aa.asset.mimeType,
          description: aa.asset.description,
          createdAt: aa.asset.createdAt,
          uploadedBy: aa.asset.uploadedByUser
        }
      }))
    })

  } catch (error) {
    console.error('Error fetching floorplan assets:', error)
    return NextResponse.json({
      error: 'Failed to fetch assets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const assetId = url.searchParams.get('assetId')

    if (!assetId) {
      return NextResponse.json({ 
        error: 'Asset ID is required' 
      }, { status: 400 })
    }

    // Find the asset and verify access
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        orgId: session.user.orgId,
        projectId: resolvedParams.id,
        type: {
          in: ['FLOORPLAN_PDF', 'FLOORPLAN_CAD']
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete the asset (cascade will handle related records)
    await prisma.asset.delete({
      where: { id: assetId }
    })

    // Log the deletion
    await logActivity({
      session,
      action: ActivityActions.ASSET_DELETED,
      entity: EntityTypes.ASSET,
      entityId: assetId,
      details: {
        fileName: asset.title,
        fileType: asset.type,
        category: 'floorplan_approval'
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Floorplan asset deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting floorplan asset:', error)
    return NextResponse.json({
      error: 'Failed to delete asset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}