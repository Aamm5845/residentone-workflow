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

    // Also get supplier quote documents linked to this item through RFQ line items
    const rfqLineItems = await prisma.rFQLineItem.findMany({
      where: { roomFFEItemId: itemId },
      select: {
        rfq: {
          select: {
            supplierRFQs: {
              select: {
                supplier: { select: { name: true } },
                vendorName: true,
                quotes: {
                  where: { quoteDocumentUrl: { not: null } },
                  select: {
                    id: true,
                    quoteDocumentUrl: true,
                    quoteNumber: true,
                    submittedAt: true
                  },
                  orderBy: { submittedAt: 'desc' }
                }
              }
            }
          }
        }
      }
    })

    // Extract supplier quote documents
    const supplierQuoteDocs: Array<{
      id: string
      title: string
      description: string | null
      fileName: string
      fileUrl: string
      fileSize: number | null
      mimeType: string | null
      type: string
      dropboxPath: string | null
      visibleToClient: boolean
      visibleToSupplier: boolean
      createdAt: Date
      uploadedBy: { name: string } | null
    }> = []

    for (const lineItem of rfqLineItems) {
      if (lineItem.rfq?.supplierRFQs) {
        for (const supplierRfq of lineItem.rfq.supplierRFQs) {
          const supplierName = supplierRfq.supplier?.name || supplierRfq.vendorName || 'Supplier'
          for (const quote of supplierRfq.quotes) {
            if (quote.quoteDocumentUrl) {
              supplierQuoteDocs.push({
                id: `supplier-quote-${quote.id}`,
                title: `Quote from ${supplierName}`,
                description: quote.quoteNumber ? `Quote #${quote.quoteNumber}` : null,
                fileName: quote.quoteDocumentUrl.split('/').pop() || 'quote.pdf',
                fileUrl: quote.quoteDocumentUrl,
                fileSize: null,
                mimeType: 'application/pdf',
                type: 'SUPPLIER_QUOTE',
                dropboxPath: null,
                visibleToClient: false,
                visibleToSupplier: true,
                createdAt: quote.submittedAt || new Date(),
                uploadedBy: { name: supplierName }
              })
            }
          }
        }
      }
    }

    // Helper to fix Dropbox URLs - convert raw=1 to dl=0 for document viewing
    const fixDropboxUrl = (url: string | null): string | null => {
      if (!url) return url
      // Convert raw=1 to dl=0 for Dropbox URLs so documents open in browser
      if (url.includes('dropbox.com') && url.includes('raw=1')) {
        return url.replace('raw=1', 'dl=0')
      }
      return url
    }

    // Combine all documents
    const allDocuments = [
      ...documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileUrl: fixDropboxUrl(doc.fileUrl),
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        type: doc.type,
        dropboxPath: doc.dropboxPath,
        visibleToClient: doc.visibleToClient,
        visibleToSupplier: doc.visibleToSupplier,
        createdAt: doc.createdAt,
        uploadedBy: doc.uploadedBy
      })),
      ...supplierQuoteDocs
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      documents: allDocuments
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
          // For documents/PDFs, use dl=0 for browser viewing instead of raw=1
          // raw=1 is for direct image embedding, dl=0 is for viewing in browser
          fileUrl = result.sharedLink.replace('raw=1', 'dl=0')
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

    // Check if this is a supplier quote document (ID starts with "supplier-quote-")
    if (documentId.startsWith('supplier-quote-')) {
      const quoteId = documentId.replace('supplier-quote-', '')

      // Find the supplier quote
      const quote = await prisma.supplierQuote.findFirst({
        where: {
          id: quoteId,
          supplierRFQ: {
            rfq: {
              orgId
            }
          }
        }
      })

      if (!quote) {
        return NextResponse.json({ error: 'Supplier quote not found' }, { status: 404 })
      }

      // Try to delete from Dropbox if it's a Dropbox URL
      if (quote.quoteDocumentUrl && dropboxService.isConfigured()) {
        // Extract path from URL if it's a Dropbox shared link
        try {
          // Dropbox shared links contain the path, try to delete
          const url = quote.quoteDocumentUrl
          if (url.includes('dropbox.com') || url.includes('dl.dropboxusercontent.com')) {
            console.log('[ItemDocuments] Supplier quote URL is from Dropbox, attempting to find and delete')
            // Note: We can't easily get the path from a shared link, so we just clear the URL
          }
        } catch (dropboxError) {
          console.warn('[ItemDocuments] Could not delete supplier quote from Dropbox:', dropboxError)
        }
      }

      // Clear the quote document URL (don't delete the whole quote record)
      await prisma.supplierQuote.update({
        where: { id: quoteId },
        data: { quoteDocumentUrl: null }
      })

      return NextResponse.json({
        success: true,
        message: 'Supplier quote document removed'
      })
    }

    // Regular document deletion
    // First try to find document linked to this specific item
    let document = await prisma.rFQDocument.findFirst({
      where: {
        id: documentId,
        orgId,
        specItemId: itemId
      }
    })

    // If not found, try to find by ID only (for older docs or docs with different specItemId)
    if (!document) {
      document = await prisma.rFQDocument.findFirst({
        where: {
          id: documentId,
          orgId
        }
      })
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found - ID: ' + documentId }, { status: 404 })
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

/**
 * PUT /api/ffe/v2/rooms/[roomId]/items/[itemId]/documents
 * Update document title and description
 */
export async function PUT(
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
    const body = await request.json()
    const { documentId, title, description } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // First try to find document linked to this specific item
    let document = await prisma.rFQDocument.findFirst({
      where: {
        id: documentId,
        orgId,
        specItemId: itemId
      }
    })

    // If not found, try to find by ID only (for older docs or docs with different specItemId)
    if (!document) {
      document = await prisma.rFQDocument.findFirst({
        where: {
          id: documentId,
          orgId
        }
      })
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found - ID: ' + documentId }, { status: 404 })
    }

    // Update document
    const updated = await prisma.rFQDocument.update({
      where: { id: documentId },
      data: {
        title: title || document.title,
        description: description ?? document.description
      }
    })

    return NextResponse.json({
      success: true,
      document: {
        id: updated.id,
        title: updated.title,
        description: updated.description
      }
    })

  } catch (error) {
    console.error('[ItemDocuments PUT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    )
  }
}
