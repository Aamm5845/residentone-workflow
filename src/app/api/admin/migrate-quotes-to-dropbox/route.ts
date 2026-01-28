import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large migrations

/**
 * POST /api/admin/migrate-quotes-to-dropbox
 * Migrate supplier quote documents from Blob storage to Dropbox
 *
 * Body:
 * - projectId: string (required)
 * - dryRun: boolean (optional, default true) - if true, only report what would be migrated
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { projectId, dryRun = true } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Get project with dropbox folder
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: {
        id: true,
        name: true,
        dropboxFolder: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({
        error: 'Project does not have a Dropbox folder configured',
        message: 'Please link a Dropbox folder to this project first'
      }, { status: 400 })
    }

    if (!dropboxService.isConfigured()) {
      return NextResponse.json({
        error: 'Dropbox is not configured',
        message: 'Check Dropbox environment variables'
      }, { status: 503 })
    }

    // Find all RFQs for this project
    const rfqs = await prisma.rFQ.findMany({
      where: { projectId },
      select: { id: true }
    })
    const rfqIds = rfqs.map(r => r.id)

    // Find all documents that are NOT in Dropbox (in Blob or no provider set)
    // These include:
    // 1. RFQ documents
    // 2. Supplier quote documents (via supplierQuoteId)
    // 3. Order documents
    const documentsToMigrate = await prisma.rFQDocument.findMany({
      where: {
        OR: [
          { rfqId: { in: rfqIds } },
          {
            supplierQuote: {
              supplierRFQ: {
                rfqId: { in: rfqIds }
              }
            }
          },
          {
            order: {
              projectId
            }
          }
        ],
        // Only get documents NOT already in Dropbox
        OR: [
          { provider: { not: 'dropbox' } },
          { provider: null },
          { dropboxPath: null }
        ]
      },
      include: {
        supplierQuote: {
          include: {
            supplierRFQ: {
              include: {
                supplier: { select: { name: true } }
              }
            }
          }
        },
        order: {
          select: {
            orderNumber: true,
            supplier: { select: { name: true } }
          }
        }
      }
    })

    // Also find supplier quotes that have quoteDocumentUrl in Blob
    const supplierQuotesWithBlobDocs = await prisma.supplierQuote.findMany({
      where: {
        supplierRFQ: {
          rfqId: { in: rfqIds }
        },
        quoteDocumentUrl: {
          not: null,
          contains: 'blob.vercel-storage.com'
        }
      },
      include: {
        supplierRFQ: {
          include: {
            supplier: { select: { name: true } }
          }
        }
      }
    })

    const results: Array<{
      type: 'document' | 'quote'
      id: string
      fileName: string
      supplierName: string
      oldUrl: string
      newDropboxPath?: string
      status: 'pending' | 'success' | 'failed'
      error?: string
    }> = []

    // Process RFQ documents
    for (const doc of documentsToMigrate) {
      const supplierName = doc.supplierQuote?.supplierRFQ?.supplier?.name
        || doc.order?.supplier?.name
        || 'Unknown Supplier'

      // Determine folder type based on document type
      let folderType = 'Other'
      switch (doc.type) {
        case 'SUPPLIER_QUOTE':
        case 'QUOTE_REQUEST':
          folderType = 'Quotes'
          break
        case 'INVOICE':
        case 'RECEIPT':
          folderType = 'Invoices'
          break
        case 'DRAWING':
        case 'SPEC_SHEET':
          folderType = 'Drawings'
          break
        case 'PHOTO':
          folderType = 'Photos'
          break
        case 'SHIPPING_DOC':
        case 'PACKING_SLIP':
          folderType = 'Shipping'
          break
      }

      const result: typeof results[0] = {
        type: 'document',
        id: doc.id,
        fileName: doc.fileName,
        supplierName,
        oldUrl: doc.fileUrl,
        status: 'pending'
      }

      if (!dryRun) {
        try {
          // Download from Blob
          const response = await fetch(doc.fileUrl)
          if (!response.ok) {
            throw new Error(`Failed to download from Blob: ${response.status}`)
          }
          const buffer = Buffer.from(await response.arrayBuffer())

          // Upload to Dropbox
          const uploadResult = await dropboxService.uploadShoppingFile(
            project.dropboxFolder!,
            supplierName,
            folderType,
            doc.fileName,
            buffer
          )

          // Update database
          await prisma.rFQDocument.update({
            where: { id: doc.id },
            data: {
              dropboxPath: uploadResult.path,
              fileUrl: uploadResult.sharedLink || uploadResult.path,
              provider: 'dropbox'
            }
          })

          result.newDropboxPath = uploadResult.path
          result.status = 'success'
        } catch (error) {
          result.status = 'failed'
          result.error = error instanceof Error ? error.message : 'Unknown error'
        }
      }

      results.push(result)
    }

    // Process supplier quote documents (quoteDocumentUrl field)
    for (const quote of supplierQuotesWithBlobDocs) {
      const supplierName = quote.supplierRFQ.supplier?.name
        || quote.supplierRFQ.vendorName
        || 'Unknown Supplier'

      // Extract filename from URL
      const urlParts = quote.quoteDocumentUrl!.split('/')
      const fileName = urlParts[urlParts.length - 1].split('?')[0] || `quote-${quote.id}.pdf`

      const result: typeof results[0] = {
        type: 'quote',
        id: quote.id,
        fileName,
        supplierName,
        oldUrl: quote.quoteDocumentUrl!,
        status: 'pending'
      }

      if (!dryRun) {
        try {
          // Download from Blob
          const response = await fetch(quote.quoteDocumentUrl!)
          if (!response.ok) {
            throw new Error(`Failed to download from Blob: ${response.status}`)
          }
          const buffer = Buffer.from(await response.arrayBuffer())

          // Upload to Dropbox
          const uploadResult = await dropboxService.uploadShoppingFile(
            project.dropboxFolder!,
            supplierName,
            'Quotes',
            fileName,
            buffer
          )

          // Update database
          await prisma.supplierQuote.update({
            where: { id: quote.id },
            data: {
              quoteDocumentUrl: uploadResult.sharedLink || uploadResult.path
            }
          })

          result.newDropboxPath = uploadResult.path
          result.status = 'success'
        } catch (error) {
          result.status = 'failed'
          result.error = error instanceof Error ? error.message : 'Unknown error'
        }
      }

      results.push(result)
    }

    const summary = {
      projectId,
      projectName: project.name,
      dropboxFolder: project.dropboxFolder,
      dryRun,
      totalDocuments: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      pending: results.filter(r => r.status === 'pending').length
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      message: dryRun
        ? `Found ${results.length} documents to migrate. Set dryRun: false to execute migration.`
        : `Migration complete. ${summary.success} succeeded, ${summary.failed} failed.`
    })

  } catch (error) {
    console.error('[MigrateQuotes] Error:', error)
    return NextResponse.json(
      { error: 'Failed to migrate documents' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/migrate-quotes-to-dropbox?projectId=xxx
 * Preview what documents would be migrated (dry run)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 })
  }

  // Create a fake request body for POST handler
  const fakeRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ projectId, dryRun: true }),
    headers: request.headers
  })

  return POST(fakeRequest)
}
