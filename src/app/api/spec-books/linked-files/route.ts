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
        linkedFiles: [] 
      })
    }

    // Find section
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