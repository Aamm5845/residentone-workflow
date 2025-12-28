import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
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

    // Validate token
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
                name: true
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

    // Generate unique filename
    const fileExtension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const uniqueId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${uniqueId}_${originalName}`

    try {
      // Convert file to buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Upload to Dropbox - supplier quotes folder
      const dropboxService = new DropboxService()

      const projectName = supplierRFQ.rfq.project.name.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50)
      const supplierName = (supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30)
      const rfqNumber = supplierRFQ.rfq.rfqNumber

      // Create organized folder structure
      const basePath = `/Meisner Interiors Team Folder/11- SOFTWARE UPLOADS`
      const quotesFolder = `${basePath}/Supplier Quotes`
      const projectFolder = `${quotesFolder}/${projectName}`
      const supplierFolder = `${projectFolder}/${rfqNumber} - ${supplierName}`

      // Ensure folders exist
      try {
        await dropboxService.createFolder(quotesFolder)
        await dropboxService.createFolder(projectFolder)
        await dropboxService.createFolder(supplierFolder)
      } catch (folderError) {
        // Folders may already exist
      }

      const dropboxPath = `${supplierFolder}/${fileName}`

      const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
      const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)

      if (!sharedLink) {
        throw new Error('Failed to create shared link')
      }

      // Log the upload
      await prisma.supplierAccessLog.create({
        data: {
          supplierRFQId: supplierRFQ.id,
          action: 'FILE_UPLOADED',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dropboxPath: dropboxPath
          }
        }
      })

      return NextResponse.json({
        success: true,
        url: sharedLink,
        fileName: file.name,
        fileSize: file.size,
        dropboxPath: dropboxPath
      })

    } catch (storageError) {
      console.error('Dropbox upload error:', storageError)
      return NextResponse.json({
        error: 'Upload failed',
        details: 'Failed to save file. Please try again.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Supplier upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: 'An unexpected error occurred'
    }, { status: 500 })
  }
}
