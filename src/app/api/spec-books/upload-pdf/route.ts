import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const sectionType = formData.get('sectionType') as string | null
    const sectionId = formData.get('sectionId') as string | null

    // Handle both direct file upload (with projectId + sectionType) 
    // and metadata-only upload (with sectionId + fileName + uploadedPdfUrl)
    let targetSectionId: string
    let uploadedPdfUrl: string | undefined
    let fileName: string
    let fileSize: number | undefined
    let pageCount: number | undefined

    if (file && projectId && sectionType) {
      // Direct file upload flow
      fileName = file.name
      fileSize = file.size

      // Upload to Vercel Blob
      const { put } = await import('@vercel/blob')
      const blob = await put(`spec-books/${projectId}/${sectionType}/${file.name}`, file, {
        access: 'public',
      })
      uploadedPdfUrl = blob.url

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
            name: 'Default Spec Book'
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
    } else if (sectionId) {
      // Legacy flow: metadata-only upload
      const jsonData = await request.json()
      fileName = jsonData.fileName
      uploadedPdfUrl = jsonData.uploadedPdfUrl
      fileSize = jsonData.fileSize
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
    } else {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
