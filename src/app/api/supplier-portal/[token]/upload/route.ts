import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Validate token and get RFQ with line items to determine category
    const supplierRFQ = await prisma.supplierRFQ.findFirst({
      where: {
        accessToken: token,
        tokenExpiresAt: { gte: new Date() }
      },
      include: {
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            project: {
              select: {
                id: true,
                name: true,
                dropboxFolder: true
              }
            },
            lineItems: {
              take: 1,
              include: {
                roomFFEItem: {
                  select: {
                    section: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File too large',
        details: `File size must be less than 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
      }, { status: 400 })
    }

    // File type validation
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return NextResponse.json({
        error: 'Invalid file type',
        details: `Allowed types: PDF, Word, Excel, images`
      }, { status: 400 })
    }

    // Generate unique filename with supplier name for clarity
    const supplierName = (supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30)
    const rfqNumber = supplierRFQ.rfq.rfqNumber
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${rfqNumber}_${supplierName}_${timestamp}_${originalName}`

    try {
      // Convert file to buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const dropboxService = new DropboxService()

      // Get project folder path - use stored path or construct from project name
      let projectFolderPath = supplierRFQ.rfq.project.dropboxFolder
      if (!projectFolderPath) {
        const projectName = supplierRFQ.rfq.project.name.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50)
        projectFolderPath = `/Meisner Interiors Team Folder/${projectName}`
      }

      // Determine category from RFQ line items (section name)
      // Default to "General" if no category found
      const categoryName = supplierRFQ.rfq.lineItems[0]?.roomFFEItem?.section?.name || 'General'

      console.log('[Supplier Upload] Uploading to:', projectFolderPath, 'Category:', categoryName)

      // Upload to 6- SHOPPING/{Category}/Quotes/ using the existing method
      const result = await dropboxService.uploadShoppingFile(
        projectFolderPath,
        categoryName,
        'Quotes',
        fileName,
        buffer
      )

      console.log('[Supplier Upload] Upload result:', result)

      // Use shared link if available, otherwise use the path
      const fileUrl = result.sharedLink || result.path

      // Log the upload
      await prisma.supplierAccessLog.create({
        data: {
          supplierRFQId: supplierRFQ.id,
          action: 'FILE_UPLOADED',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dropboxPath: result.path,
            category: categoryName
          }
        }
      })

      return NextResponse.json({
        success: true,
        url: fileUrl,
        fileName: file.name,
        fileSize: file.size,
        dropboxPath: result.path
      })

    } catch (storageError: any) {
      console.error('Dropbox upload error:', storageError)
      return NextResponse.json({
        error: 'Upload failed',
        details: storageError?.message || 'Failed to save file. Please try again.'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Supplier upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error?.message || 'An unexpected error occurred'
    }, { status: 500 })
  }
}
