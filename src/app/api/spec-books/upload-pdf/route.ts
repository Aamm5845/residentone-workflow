import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check content type to determine which flow to use
    const contentType = request.headers.get('content-type') || ''
    
    let targetSectionId: string
    let uploadedPdfUrl: string | undefined
    let fileName: string
    let fileSize: number | undefined
    let pageCount: number | undefined

    if (contentType.includes('multipart/form-data')) {
      // Direct file upload flow with formData
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const projectId = formData.get('projectId') as string | null
      const sectionType = formData.get('sectionType') as string | null

      if (!file || !projectId || !sectionType) {
        return NextResponse.json(
          { error: 'Missing required fields: file, projectId, and sectionType' },
          { status: 400 }
        )
      }

      fileName = file.name
      fileSize = file.size

      // Upload to Dropbox
      const { DropboxService } = await import('@/lib/dropbox-service')
      const dropboxService = new DropboxService()
      
      const timestamp = Date.now()
      const uniqueFileName = `${timestamp}-${file.name}`
      const dropboxPath = `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/Spec Books/${projectId}/${sectionType}/${uniqueFileName}`
      
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
      const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)
      
      if (!sharedLink) {
        return NextResponse.json({ 
          error: 'Failed to create shared link for spec book PDF' 
        }, { status: 500 })
      }
      
      uploadedPdfUrl = sharedLink

      // Get page count from PDF
      try {
        const PDFDocument = (await import('pdf-lib')).PDFDocument
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        pageCount = pdfDoc.getPageCount()
      } catch (error) {
        console.error('Error reading PDF page count:', error)
      }

      // Find or create spec book and section
      let specBook = await prisma.specBook.findFirst({
        where: {
          projectId,
          project: {
            orgId: session.user.orgId
          }
        }
      })

      if (!specBook) {
        specBook = await prisma.specBook.create({
          data: {
            projectId,
            name: 'Default Spec Book',
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
      }

      // Find or create section
      let section = await prisma.specBookSection.findFirst({
        where: {
          specBookId: specBook.id,
          type: sectionType,
          roomId: null
        }
      })

      if (!section) {
        section = await prisma.specBookSection.create({
          data: {
            specBookId: specBook.id,
            type: sectionType,
            name: sectionType,
            isIncluded: true
          }
        })
      }

      targetSectionId = section.id
    } else {
      // Legacy flow: JSON payload with metadata
      const jsonData = await request.json()
      const sectionId = jsonData.sectionId
      fileName = jsonData.fileName
      uploadedPdfUrl = jsonData.uploadedPdfUrl
      fileSize = jsonData.fileSize

      if (!sectionId || !fileName || !uploadedPdfUrl) {
        return NextResponse.json(
          { error: 'Missing required fields: sectionId, fileName, and uploadedPdfUrl' },
          { status: 400 }
        )
      }

      targetSectionId = sectionId

      // Verify section exists and user has access
      const section = await prisma.specBookSection.findFirst({
        where: {
          id: sectionId,
          specBook: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      })

      if (!section) {
        return NextResponse.json(
          { error: 'Section not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Create a file link entry for the uploaded PDF
    // Use a unique dropboxPath to avoid conflicts (uploaded PDFs don't have real Dropbox paths)
    const fileLink = await prisma.dropboxFileLink.create({
      data: {
        sectionId: targetSectionId,
        fileName,
        uploadedPdfUrl,
        fileSize: fileSize || null,
        dropboxPath: `uploaded:${Date.now()}:${fileName}`, // Unique identifier for uploaded PDFs
        isActive: true,
        cadToPdfCacheUrl: uploadedPdfUrl // Store the PDF URL
      }
    })

    return NextResponse.json({
      success: true,
      fileId: fileLink.id,
      pdfUrl: uploadedPdfUrl,
      pageCount,
      fileLink
    })

  } catch (error) {
    console.error('Error linking PDF to section:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Full error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
