import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

// Map document type to Dropbox folder
function getDropboxFolderForType(docType: string): string {
  switch (docType) {
    case 'DRAWING':
    case 'SPEC_SHEET':
      return 'Drawings'
    case 'PHOTO':
      return 'Photos'
    default:
      return 'Other'
  }
}

/**
 * POST /api/orders/[id]/documents
 * Upload a document to an order (internal use)
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

    const { id: orderId } = await params
    const orgId = (session.user as any).orgId
    const userId = (session.user as any).id

    // Find order
    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            dropboxFolder: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string || 'Uploaded Document'
    const description = formData.get('description') as string || null
    const docType = formData.get('type') as string || 'OTHER'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, images, Word, Excel' },
        { status: 400 }
      )
    }

    // Map document type
    const validTypes = [
      'QUOTE_REQUEST', 'SUPPLIER_QUOTE', 'CLIENT_QUOTE', 'INVOICE',
      'PURCHASE_ORDER', 'SHIPPING_DOC', 'PACKING_SLIP', 'RECEIPT',
      'RETURN_AUTHORIZATION', 'SPEC_SHEET', 'DRAWING', 'PHOTO', 'OTHER'
    ]
    const documentType = validTypes.includes(docType) ? docType : 'OTHER'

    // Prepare file buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedFileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    let fileUrl: string
    let dropboxPath: string | null = null
    let provider = 'vercel-blob'

    // Try to upload to Dropbox if project has dropbox folder configured
    if (order.project?.dropboxFolder && dropboxService.isConfigured()) {
      try {
        // Use order number as category for organization
        const categoryName = `Orders/${order.orderNumber}`
        const dropboxFolderType = getDropboxFolderForType(documentType)

        console.log(`[Upload] Uploading to Dropbox: ${order.project.dropboxFolder}/${categoryName}/${dropboxFolderType}`)

        const result = await dropboxService.uploadShoppingFile(
          order.project.dropboxFolder,
          categoryName,
          dropboxFolderType,
          sanitizedFileName,
          fileBuffer
        )

        dropboxPath = result.path
        fileUrl = result.sharedLink || result.path
        provider = 'dropbox'

        console.log(`[Upload] Successfully uploaded to Dropbox: ${dropboxPath}`)
      } catch (dropboxError) {
        console.error('[Upload] Dropbox upload failed, falling back to Vercel Blob:', dropboxError)
        // Fall back to Vercel Blob
        const blobFileName = `orders/${orderId}/${sanitizedFileName}`
        const blob = await put(blobFileName, file, {
          access: 'public',
          addRandomSuffix: false
        })
        fileUrl = blob.url
      }
    } else {
      // Upload to Vercel Blob as fallback
      const blobFileName = `orders/${orderId}/${sanitizedFileName}`
      const blob = await put(blobFileName, file, {
        access: 'public',
        addRandomSuffix: false
      })
      fileUrl = blob.url
    }

    // Create document record
    const document = await prisma.rFQDocument.create({
      data: {
        orgId,
        orderId: order.id,
        type: documentType as any,
        title,
        description,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        provider,
        dropboxPath,
        visibleToSupplier: true,
        uploadedById: userId
      }
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: order.id,
        type: 'DOCUMENT_UPLOADED',
        message: `Document uploaded: ${title}`,
        userId,
        metadata: {
          documentId: document.id,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      }
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        type: document.type,
        createdAt: document.createdAt
      }
    })

  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
