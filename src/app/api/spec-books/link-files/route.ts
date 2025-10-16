import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, roomId, sectionType, dropboxFiles } = await request.json()

    if (!projectId || !dropboxFiles || !Array.isArray(dropboxFiles)) {
      return NextResponse.json(
        { error: 'projectId and dropboxFiles array are required' },
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

    // Get or create spec book
    let specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true
      }
    })

    if (!specBook) {
      specBook = await prisma.specBook.create({
        data: {
          projectId,
          name: `${project.name} Spec Book`,
          description: 'Auto-generated spec book',
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }

    // Get or create section
    let section = await prisma.specBookSection.findFirst({
      where: {
        specBookId: specBook.id,
        type: sectionType || 'ROOM',
        roomId: roomId || null
      }
    })

    if (!section) {
      const sectionName = roomId 
        ? `Room ${roomId}` 
        : getSectionDisplayName(sectionType || 'ROOM')
      
      section = await prisma.specBookSection.create({
        data: {
          specBookId: specBook.id,
          type: sectionType || 'ROOM',
          name: sectionName,
          roomId: roomId || null,
          order: getDefaultSectionOrder(sectionType || 'ROOM')
        }
      })
    }

    // Link the files
    const linkedFiles = []
    for (const file of dropboxFiles) {
      try {
        // Get file metadata from Dropbox to verify it exists
        const metadata = await dropboxService.getFileMetadata(file.path)
        if (!metadata) {
          console.warn(`File not found in Dropbox: ${file.path}`)
          continue
        }

        // Create or update the file link
        const fileLink = await prisma.dropboxFileLink.upsert({
          where: {
            sectionId_dropboxPath: {
              sectionId: section.id,
              dropboxPath: file.path
            }
          },
          update: {
            fileName: file.name,
            fileSize: file.size,
            lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
            dropboxRevision: metadata.revision,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            sectionId: section.id,
            dropboxPath: file.path,
            fileName: file.name,
            fileSize: file.size,
            lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
            dropboxRevision: metadata.revision,
            isActive: true
          }
        })

        linkedFiles.push({
          id: fileLink.id,
          fileName: fileLink.fileName,
          dropboxPath: fileLink.dropboxPath,
          fileSize: fileLink.fileSize,
          lastModified: fileLink.lastModified
        })

      } catch (error) {
        console.error(`Failed to link file ${file.path}:`, error)
        // Continue with other files
      }
    }

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
    console.error('Link files API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getSectionDisplayName(sectionType: string): string {
  const displayNames: Record<string, string> = {
    FLOORPLANS: 'Floor Plans',
    LIGHTING: 'Lighting Plans',
    ELECTRICAL: 'Electrical Plans',
    PLUMBING: 'Plumbing Plans',
    STRUCTURAL: 'Structural Plans',
    RCP: 'Reflected Ceiling Plans',
    ROOM: 'Room Content',
    DRAWINGS: 'Room Drawings'
  }
  return displayNames[sectionType] || sectionType
}

function getDefaultSectionOrder(sectionType: string): number {
  const orders: Record<string, number> = {
    FLOORPLANS: 1,
    LIGHTING: 2,
    ELECTRICAL: 3,
    PLUMBING: 4,
    STRUCTURAL: 5,
    RCP: 6,
    ROOM: 100,
    DRAWINGS: 101
  }
  return orders[sectionType] || 99
}
