import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Get the active spec book for this project
    const specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        sections: {
          include: {
            dropboxFiles: {
              where: {
                isActive: true
              },
              orderBy: {
                fileName: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!specBook) {
      return NextResponse.json({ error: 'No active spec book found' }, { status: 404 })
    }

    // Format the response to show what's actually linked
    const linkedFiles = specBook.sections.map(section => ({
      sectionId: section.id,
      sectionName: section.name,
      sectionType: section.type,
      roomId: section.roomId,
      files: section.dropboxFiles.map(file => ({
        id: file.id,
        fileName: file.fileName,
        dropboxPath: file.dropboxPath,
        dropboxFileId: file.dropboxFileId,
        isActive: file.isActive,
        hasCachedPdf: !!file.cadToPdfCacheUrl,
        updatedAt: file.updatedAt
      }))
    }))

    return NextResponse.json({
      specBookId: specBook.id,
      specBookName: specBook.name,
      sections: linkedFiles,
      totalSections: linkedFiles.length,
      totalFiles: linkedFiles.reduce((sum, section) => sum + section.files.length, 0)
    })

  } catch (error) {
    console.error('Debug linked files error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
