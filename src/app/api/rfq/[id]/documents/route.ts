import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { DropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

// File upload configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB for RFQ documents
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
}

/**
 * GET /api/rfq/[id]/documents
 * Get all documents attached to an RFQ
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    // Get documents
    const documents = await prisma.rFQDocument.findMany({
      where: { rfqId: id },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching RFQ documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rfq/[id]/documents
 * Upload a document to an RFQ (visible to suppliers in portal)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId },
      include: {
        project: { select: { name: true } }
      }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string || file?.name
    const description = formData.get('description') as string || null
    const visibleToSupplier = formData.get('visibleToSupplier') !== 'false' // Default true
    const documentType = formData.get('type') as string || 'SPEC_SHEET'

    // Validation
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }, { status: 400 })
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json({
        error: `File type not allowed. Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG`
      }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = ALLOWED_TYPES[file.type]
    const uniqueId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${uniqueId}_${sanitizedName}`

    // Upload to Dropbox
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const dropboxService = new DropboxService()

    // Create folder structure
    const basePath = `/Meisner Interiors Team Folder/11- SOFTWARE UPLOADS`
    const rfqFolder = `${basePath}/RFQ Documents/${rfq.rfqNumber}`

    try {
      await dropboxService.createFolder(basePath)
      await dropboxService.createFolder(`${basePath}/RFQ Documents`)
      await dropboxService.createFolder(rfqFolder)
    } catch (folderError) {
      // Folders may already exist
    }

    const dropboxPath = `${rfqFolder}/${fileName}`
    const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
    const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)

    if (!sharedLink) {
      throw new Error('Failed to create shared link')
    }

    // Save document record
    const document = await prisma.rFQDocument.create({
      data: {
        orgId,
        rfqId: id,
        type: documentType as any,
        title,
        description,
        fileName: file.name,
        fileUrl: sharedLink,
        fileSize: file.size,
        mimeType: file.type,
        provider: 'dropbox',
        dropboxPath: uploadResult.path_display,
        visibleToSupplier,
        visibleToClient: false,
        uploadedById: userId
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Log activity
    await prisma.rFQActivity.create({
      data: {
        rfqId: id,
        type: 'DOCUMENT_UPLOADED',
        message: `Document "${title}" uploaded${visibleToSupplier ? ' (visible to suppliers)' : ''}`,
        userId,
        metadata: {
          documentId: document.id,
          fileName: file.name,
          fileSize: file.size
        }
      }
    })

    return NextResponse.json({
      success: true,
      document
    })
  } catch (error) {
    console.error('Error uploading RFQ document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rfq/[id]/documents
 * Delete a document from an RFQ
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Verify document belongs to this RFQ and org
    const document = await prisma.rFQDocument.findFirst({
      where: {
        id: documentId,
        rfqId: id,
        orgId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete from Dropbox if path exists
    if (document.dropboxPath) {
      try {
        const dropboxService = new DropboxService()
        await dropboxService.deleteFile(document.dropboxPath)
      } catch (dropboxError) {
        console.warn('Failed to delete from Dropbox:', dropboxError)
        // Continue with database deletion
      }
    }

    // Delete document record
    await prisma.rFQDocument.delete({
      where: { id: documentId }
    })

    // Log activity
    await prisma.rFQActivity.create({
      data: {
        rfqId: id,
        type: 'DOCUMENT_DELETED',
        message: `Document "${document.title}" deleted`,
        userId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting RFQ document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
