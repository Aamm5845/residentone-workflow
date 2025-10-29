import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PROJECT_LEVEL_SECTIONS } from '@/components/spec-book/constants'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const roomId = searchParams.get('roomId')
    const sectionType = searchParams.get('sectionType')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Find spec book
    const specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true
      }
    })

    if (!specBook) {
      return NextResponse.json({ 
        success: true, 
        linkedFiles: [],
        sections: []
      })
    }

    // If requesting all project-level sections (no roomId and no sectionType)
    if (!roomId && !sectionType) {
      const planTypes = PROJECT_LEVEL_SECTIONS.map(section => section.type)
      
      const sections = await prisma.specBookSection.findMany({
        where: {
          specBookId: specBook.id,
          roomId: null,
          type: { in: planTypes }
        },
        include: {
          dropboxFiles: {
            where: {
              isActive: true
            }
          }
        },
        orderBy: {
          order: 'asc'
        }
      })

      const formattedSections = sections.map(section => ({
        id: section.id,
        type: section.type,
        name: section.name,
        order: section.order,
        files: section.dropboxFiles.map(file => ({
          id: file.id,
          dropboxPath: file.dropboxPath,
          fileName: file.fileName,
          fileSize: file.fileSize,
          lastModified: file.lastModified,
          cadToPdfCacheUrl: file.cadToPdfCacheUrl
        }))
      }))

      return NextResponse.json({
        success: true,
        sections: formattedSections
      })
    }

    // Original behavior for specific section
    const section = await prisma.specBookSection.findFirst({
      where: {
        specBookId: specBook.id,
        type: sectionType || 'ROOM',
        roomId: roomId || null
      },
      include: {
        dropboxFiles: {
          where: {
            isActive: true
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ 
        success: true, 
        linkedFiles: [] 
      })
    }

    // Format the linked files
    const linkedFiles = section.dropboxFiles.map(file => ({
      id: file.id,
      name: file.fileName,
      path: file.dropboxPath,
      size: file.fileSize || 0,
      lastModified: file.lastModified || new Date(),
      revision: file.dropboxRevision || '',
      isFolder: false
    }))

    return NextResponse.json({
      success: true,
      linkedFiles,
      section: {
        id: section.id,
        name: section.name,
        type: section.type
      }
    })

  } catch (error) {
    console.error('Fetch linked files API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
