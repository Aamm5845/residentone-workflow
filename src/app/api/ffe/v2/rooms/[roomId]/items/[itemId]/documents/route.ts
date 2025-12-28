import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ffe/v2/rooms/[roomId]/items/[itemId]/documents
 * Get all documents for a specific spec item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = (session.user as any).orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { roomId, itemId } = await params

    // Verify item exists and belongs to org
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: { orgId }
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        section: {
          select: {
            name: true
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get all documents directly linked to this item
    const documents = await prisma.rFQDocument.findMany({
      where: {
        orgId,
        specItemId: itemId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        type: doc.type,
        dropboxPath: doc.dropboxPath,
        visibleToClient: doc.visibleToClient,
        visibleToSupplier: doc.visibleToSupplier,
        createdAt: doc.createdAt,
        uploadedBy: doc.uploadedBy
      }))
    })

  } catch (error) {
    console.error('[ItemDocuments GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get documents' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ffe/v2/rooms/[roomId]/items/[itemId]/documents
 * Upload a document for a specific spec item
 *
 * Body (FormData):
 * - file: File to upload
 * - fileType: "Drawings" | "Quotes" | "Invoices" (default: "Drawings")
 * - title?: Document title (defaults to filename)
 * - description?: Document description
 * - documentType?: "DRAWING" | "SUPPLIER_QUOTE" | "INVOICE" | "SPEC_SHEET" | "OTHER"
 * - visibleToClient?: boolean
 * - visibleToSupplier?: boolean
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userId = (session.user as any).id
    let orgId = (session.user as any).orgId

    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userId = user.id
      orgId = user.orgId
    }

    const { roomId, itemId } = await params

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileType = (formData.get('fileType') as string) || 'Quotes'
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const documentType = (formData.get('documentType') as string) || null
    const visibleToClient = formData.get('visibleToClient') === 'true'
    const visibleToSupplier = formData.get('visibleToSupplier') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 })
    }

    // Validate file type
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.dwg', '.dxf']
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({
        error: 'File type not supported. Allowed: Images, PDF, Word, Excel, CAD files.'
      }, { status: 400 })
    }

    // Verify item exists and get project info
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: { orgId }
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        section: {
          select: {
            name: true,
            instance: {
              select: {
                room: {
                  select: {
                    project: {
                      select: {
                        id: true,
                        name: true,
                        dropboxFolder: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const project = item.section.instance.room.project
    const categoryName = item.section.name // Use section name as category (e.g., "Plumbing", "Lighting")

    // Determine document type - must match RFQDocumentType enum
    // Priority: explicit documentType > inferred from fileType
    let docType: string = 'OTHER'
    if (documentType) {
      docType = documentType
    } else if (fileType === 'Drawings') {
      docType = 'DRAWING'
    } else if (fileType === 'Quotes') {
      docType = 'SUPPLIER_QUOTE'
    } else if (fileType === 'Invoices') {
      docType = 'INVOICE'
    } else if (fileType === 'Receipts') {
      docType = 'RECEIPT'
    } else if (fileType === 'Shipping') {
      docType = 'SHIPPING_DOC'
    }

    let fileUrl = ''
    let dropboxPath = ''

    // Upload to Dropbox if configured
    if (dropboxService.isConfigured() && project.dropboxFolder) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to 6- SHOPPING/{Category}/{FileType}/
        const result = await dropboxService.uploadShoppingFile(
          project.dropboxFolder,
          categoryName,
          fileType,
          file.name,
          buffer
        )

        dropboxPath = result.path
        if (result.sharedLink) {
          fileUrl = result.sharedLink
        }

        console.log('[ItemDocuments] File uploaded to Dropbox:', dropboxPath)
      } catch (dropboxError) {
        console.error('[ItemDocuments] Dropbox upload failed:', dropboxError)
        // Continue without Dropbox
      }
    }

    // Create document record linked to the spec item
    const document = await prisma.rFQDocument.create({
      data: {
        orgId,
        specItemId: itemId,
        type: docType,
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
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        type: document.type,
        dropboxPath: document.dropboxPath,
        visibleToClient: document.visibleToClient,
        visibleToSupplier: document.visibleToSupplier,
        createdAt: document.createdAt,
        uploadedBy: document.uploadedBy
      }
    })

  } catch (error) {
    console.error('[ItemDocuments POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ffe/v2/rooms/[roomId]/items/[itemId]/documents
 * Delete a document (pass documentId in query string)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = (session.user as any).orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { itemId } = await params
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Verify document exists and belongs to this item and org
    const document = await prisma.rFQDocument.findFirst({
      where: {
        id: documentId,
        specItemId: itemId,
        orgId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Try to delete from Dropbox if path exists
    if (document.dropboxPath && dropboxService.isConfigured()) {
      try {
        await dropboxService.deleteFile(document.dropboxPath)
        console.log('[ItemDocuments] Deleted from Dropbox:', document.dropboxPath)
      } catch (dropboxError) {
        console.warn('[ItemDocuments] Failed to delete from Dropbox:', dropboxError)
        // Continue with database deletion
      }
    }

    // Delete from database
    await prisma.rFQDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('[ItemDocuments DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
