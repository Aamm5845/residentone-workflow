import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sectionId, fileName, uploadedPdfUrl, fileSize } = await request.json()

    if (!sectionId || !fileName || !uploadedPdfUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

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

    // Create a file link entry for the uploaded PDF
    // Use a unique dropboxPath to avoid conflicts (uploaded PDFs don't have real Dropbox paths)
    const fileLink = await prisma.dropboxFileLink.create({
      data: {
        sectionId,
        fileName,
        uploadedPdfUrl,
        fileSize,
        dropboxPath: `uploaded:${Date.now()}:${fileName}`, // Unique identifier for uploaded PDFs
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
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
