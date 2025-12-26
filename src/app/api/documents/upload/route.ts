import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/documents/upload
 * Upload a document to Dropbox and create a record in the database
 *
 * Body (FormData):
 * - file: File to upload
 * - projectId: Project ID (required)
 * - category: Category name for FFE folder (e.g., "Plumbing", "Millwork")
 * - fileType: "Drawings" | "Quotes" | "Photos" (default: "Drawings")
 * - rfqId?: Link to RFQ
 * - supplierQuoteId?: Link to supplier quote
 * - clientQuoteId?: Link to client quote
 * - orderId?: Link to order
 * - title?: Document title
 * - description?: Document description
 * - visibleToClient?: boolean
 * - visibleToSupplier?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const orgId = (session.user as any).orgId

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const category = formData.get('category') as string || 'General'
    const fileType = (formData.get('fileType') as 'Drawings' | 'Quotes' | 'Photos') || 'Drawings'
    const rfqId = formData.get('rfqId') as string | null
    const supplierQuoteId = formData.get('supplierQuoteId') as string | null
    const clientQuoteId = formData.get('clientQuoteId') as string | null
    const orderId = formData.get('orderId') as string | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const visibleToClient = formData.get('visibleToClient') === 'true'
    const visibleToSupplier = formData.get('visibleToSupplier') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.dwg', '.dxf']
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      return NextResponse.json({
        error: 'File type not supported. Allowed: Images, PDF, Word, Excel, CAD files.'
      }, { status: 400 })
    }

    // Get project to find Dropbox folder
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true, dropboxFolder: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Determine document type based on what it's linked to
    let documentType: 'DRAWING' | 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'SPEC_SHEET' | 'OTHER' = 'OTHER'
    if (fileType === 'Drawings') documentType = 'DRAWING'
    else if (fileType === 'Quotes') documentType = 'QUOTE'
    else if (fileType === 'Photos') documentType = 'SPEC_SHEET'

    let fileUrl = ''
    let dropboxPath = ''

    // Upload to Dropbox if configured
    if (dropboxService.isConfigured() && project.dropboxFolder) {
      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to FFE folder
        const result = await dropboxService.uploadFFEFile(
          project.dropboxFolder,
          category,
          fileType,
          file.name,
          buffer
        )

        dropboxPath = result.path

        // Try to get shared link
        try {
          const sharedLink = await dropboxService.createSharedLink(dropboxPath)
          if (sharedLink) {
            fileUrl = sharedLink
          }
        } catch (linkError) {
          console.warn('[DocumentUpload] Could not create shared link:', linkError)
        }

        console.log('[DocumentUpload] File uploaded to Dropbox:', dropboxPath)
      } catch (dropboxError) {
        console.error('[DocumentUpload] Dropbox upload failed:', dropboxError)
        // Continue without Dropbox - will store file reference without URL
      }
    }

    // Create document record in database
    const document = await prisma.rFQDocument.create({
      data: {
        orgId,
        rfqId: rfqId || null,
        supplierQuoteId: supplierQuoteId || null,
        clientQuoteId: clientQuoteId || null,
        orderId: orderId || null,
        type: documentType,
        title: title || file.name,
        description: description || null,
        fileName: file.name,
        fileUrl: fileUrl || `dropbox:${dropboxPath}`,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        provider: dropboxPath ? 'dropbox' : 'local',
        dropboxPath: dropboxPath || null,
        visibleToClient,
        visibleToSupplier,
        uploadedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        dropboxPath: document.dropboxPath,
        type: document.type
      }
    })

  } catch (error) {
    console.error('[DocumentUpload] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
