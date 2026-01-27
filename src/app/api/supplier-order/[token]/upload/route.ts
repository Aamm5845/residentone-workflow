import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

// Notification email recipient
const NOTIFICATION_EMAIL = 'shaya@meisnerinteriors.com'

// Map document type to Dropbox folder
function getDropboxFolderForType(docType: string): string {
  switch (docType) {
    case 'DRAWING':
    case 'SPEC_SHEET':
      return 'Drawings'
    case 'SUPPLIER_QUOTE':
    case 'QUOTE_REQUEST':
      return 'Quotes'
    case 'PHOTO':
      return 'Photos'
    case 'INVOICE':
    case 'RECEIPT':
      return 'Invoices'
    case 'SHIPPING_DOC':
    case 'PACKING_SLIP':
      return 'Shipping'
    default:
      return 'Other'
  }
}

/**
 * POST /api/supplier-order/[token]/upload
 * Upload a document to the order (supplier side)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Find order with project info for Dropbox folder
    const order = await prisma.order.findUnique({
      where: { supplierAccessToken: token },
      include: {
        supplier: true,
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

    // Check token expiration
    if (order.supplierTokenExpiresAt && new Date(order.supplierTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Access token has expired' }, { status: 403 })
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
        // Use supplier name or order number as category for organization
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
        const blobFileName = `supplier-orders/${order.id}/${sanitizedFileName}`
        const blob = await put(blobFileName, file, {
          access: 'public',
          addRandomSuffix: false
        })
        fileUrl = blob.url
      }
    } else {
      // Upload to Vercel Blob as fallback
      const blobFileName = `supplier-orders/${order.id}/${sanitizedFileName}`
      const blob = await put(blobFileName, file, {
        access: 'public',
        addRandomSuffix: false
      })
      fileUrl = blob.url
    }

    // Create document record
    const document = await prisma.rFQDocument.create({
      data: {
        orgId: order.orgId,
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
        uploadedById: order.createdById // Use order creator as fallback
      }
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: order.id,
        type: 'DOCUMENT_UPLOADED',
        message: `Supplier uploaded: ${title}`,
        metadata: {
          documentId: document.id,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      }
    })

    // Send notification email
    try {
      const supplierName = order.supplier?.name || 'Supplier'
      await sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `New Document from ${supplierName} - PO #${order.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">New Document Uploaded</h2>
            <p><strong>Order:</strong> ${order.orderNumber}</p>
            <p><strong>Supplier:</strong> ${supplierName}</p>
            <p><strong>Document:</strong> ${title}</p>
            <p><strong>File:</strong> ${file.name}</p>
            <p><strong>Storage:</strong> ${provider === 'dropbox' ? 'Dropbox' : 'Cloud Storage'}</p>
            ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            <p style="margin-top: 24px;">
              <a href="${fileUrl}"
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 12px;">
                Download Document
              </a>
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/supplier-order/${token}"
                 style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Order
              </a>
            </p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr)
    }

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
