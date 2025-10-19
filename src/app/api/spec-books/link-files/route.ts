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
    const skippedFiles: Array<{ path: string; id?: string; reason: string }> = []
    
    for (const file of dropboxFiles) {
      try {
        console.log('[link-files] Incoming file:', { id: file.id, path: file.path, name: file.name })
        
        // Get metadata using the file path (works with shared links)
        const metadataPath = file.path || file.id
        const metadata = await dropboxService.getFileMetadata(metadataPath)
        if (!metadata) {
          console.warn(`[link-files] Metadata lookup failed, skipping: ${file.path} (id: ${file.id || 'n/a'})`)
          skippedFiles.push({ path: file.path, id: file.id, reason: 'metadata_not_found' })
          continue
        }

        console.log('[link-files] Metadata found:', { id: metadata.id, name: metadata.name, revision: metadata.revision })

        // Create or update the file link
        const fileLink = await prisma.dropboxFileLink.upsert({
          where: {
            sectionId_dropboxPath: {
              sectionId: section.id,
              dropboxPath: file.path // store the UI/shared-link-relative path for consistency
            }
          },
          update: {
            dropboxFileId: metadata.id || file.id || null, // store immutable file ID
            fileName: metadata.name || file.name,
            fileSize: metadata.size || file.size,
            lastModified: metadata.lastModified || (file.lastModified ? new Date(file.lastModified) : new Date()),
            dropboxRevision: metadata.revision || null,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            sectionId: section.id,
            dropboxPath: file.path,
            dropboxFileId: metadata.id || file.id || null, // store immutable file ID
            fileName: metadata.name || file.name,
            fileSize: metadata.size || file.size,
            lastModified: metadata.lastModified || (file.lastModified ? new Date(file.lastModified) : new Date()),
            dropboxRevision: metadata.revision || null,
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
        skippedFiles.push({ path: file.path, id: file.id, reason: 'exception' })
        // Continue with other files
      }
    }

    return NextResponse.json({
      success: true,
      linkedFiles,
      skippedFiles, // TEMP: include for diagnostics
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, dropboxPath, sectionId, sectionType, roomId } = await request.json()
    
    console.log('[UNLINK] Request data:', {
      projectId,
      dropboxPath,
      sectionId,
      sectionType,
      roomId
    })

    if (!projectId || !dropboxPath) {
      return NextResponse.json(
        { error: 'projectId and dropboxPath are required' },
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

    // Get active spec book
    const specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true
      }
    })

    if (!specBook) {
      return NextResponse.json({ error: 'No active spec book found' }, { status: 404 })
    }

    // Determine target section
    let targetSection
    if (sectionId) {
      // Validate sectionId belongs to this spec book
      targetSection = await prisma.specBookSection.findFirst({
        where: {
          id: sectionId,
          specBookId: specBook.id
        }
      })
      if (!targetSection) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }
    } else if (sectionType !== undefined) {
      // Look up section by type and roomId
      targetSection = await prisma.specBookSection.findFirst({
        where: {
          specBookId: specBook.id,
          type: sectionType,
          roomId: roomId || null
        }
      })
      if (!targetSection) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }
    } else {
      return NextResponse.json(
        { error: 'Either sectionId or sectionType is required' },
        { status: 400 }
      )
    }

    console.log('[UNLINK] Target section found:', {
      sectionId: targetSection.id,
      sectionName: targetSection.name,
      sectionType: targetSection.type
    })
    
    // Check what files exist before unlinking
    const existingFiles = await prisma.dropboxFileLink.findMany({
      where: {
        sectionId: targetSection.id,
        dropboxPath,
        isActive: true
      }
    })
    
    console.log('[UNLINK] Found', existingFiles.length, 'active files to unlink for path:', dropboxPath)
    existingFiles.forEach((file, index) => {
      console.log(`[UNLINK] File ${index + 1}:`, {
        id: file.id,
        fileName: file.fileName,
        dropboxPath: file.dropboxPath,
        isActive: file.isActive
      })
    })

    // Soft unlink the file (set isActive = false and clear PDF cache)
    const updatedLink = await prisma.dropboxFileLink.updateMany({
      where: {
        sectionId: targetSection.id,
        dropboxPath,
        isActive: true
      },
      data: {
        isActive: false,
        cadToPdfCacheUrl: null, // Clear cached PDF so it doesn't appear in generated spec books
        cacheExpiry: null,
        updatedAt: new Date()
      }
    })
    
    console.log('[UNLINK] Successfully unlinked', updatedLink.count, 'files')

    return NextResponse.json({
      success: true,
      unlinkedCount: updatedLink.count
    })

  } catch (error) {
    console.error('Unlink files API error:', error)
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
