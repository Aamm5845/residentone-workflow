import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { pdfGenerationService } from '@/lib/pdf-generation'
import { cadConversionService } from '@/lib/cad-conversion'
import { dropboxService } from '@/lib/dropbox-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      projectId,
      coverPageData,
      selectedSections,
      selectedRooms
    } = await request.json()

    if (!projectId || !coverPageData) {
      return NextResponse.json(
        { error: 'projectId and coverPageData are required' },
        { status: 400 }
      )
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        },
        rooms: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
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

    // Process selected sections - convert CAD files if needed
    const processedSections = []
    for (const sectionType of selectedSections || []) {
      // Create or update section
      let section = await prisma.specBookSection.findFirst({
        where: {
          specBookId: specBook.id,
          type: sectionType,
          roomId: null
        },
        include: {
          dropboxFiles: true
        }
      })

      if (!section) {
        section = await prisma.specBookSection.create({
          data: {
            specBookId: specBook.id,
            type: sectionType,
            name: getSectionDisplayName(sectionType),
            roomId: null,
            order: getDefaultSectionOrder(sectionType)
          },
          include: {
            dropboxFiles: true
          }
        })
      }

      processedSections.push(section)
    }

    // Process selected rooms
    const processedRooms = []
    for (const roomId of selectedRooms || []) {
      const room = project.rooms.find(r => r.id === roomId)
      if (!room) continue

      // Get room's spec book section
      let roomSection = await prisma.specBookSection.findFirst({
        where: {
          specBookId: specBook.id,
          type: 'ROOM',
          roomId: roomId
        },
        include: {
          dropboxFiles: true
        }
      })

      if (!roomSection) {
        roomSection = await prisma.specBookSection.create({
          data: {
            specBookId: specBook.id,
            type: 'ROOM',
            name: room.name || room.type.replace('_', ' '),
            roomId: roomId,
            order: 100 // Rooms come after project sections
          },
          include: {
            dropboxFiles: true
          }
        })
      }

      // Process CAD files for this room
      const cadFiles = []
      for (const dropboxFile of roomSection.dropboxFiles) {
        if (dropboxFile.cadToPdfCacheUrl) {
          cadFiles.push({
            fileName: dropboxFile.fileName,
            pdfUrl: dropboxFile.cadToPdfCacheUrl
          })
        } else {
          // Convert CAD file if not cached
          try {
            const fileBuffer = await dropboxService.downloadFile(dropboxFile.dropboxPath)
            const conversionResult = await cadConversionService.convertCADToPDF(
              dropboxFile.dropboxPath,
              dropboxFile.dropboxRevision || '',
              fileBuffer
            )

            if (conversionResult.success && conversionResult.pdfUrl) {
              // Update cache in database
              await prisma.dropboxFileLink.update({
                where: { id: dropboxFile.id },
                data: {
                  cadToPdfCacheUrl: conversionResult.pdfUrl,
                  cacheExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                }
              })

              cadFiles.push({
                fileName: dropboxFile.fileName,
                pdfUrl: conversionResult.pdfUrl
              })
            }
          } catch (error) {
            console.error(`Failed to convert CAD file ${dropboxFile.fileName}:`, error)
            // Continue without this file
          }
        }
      }

      processedRooms.push({
        id: room.id,
        name: room.name || room.type.replace('_', ' '),
        type: room.type,
        renderingUrl: roomSection.renderingUrl,
        cadFiles
      })
    }

    // Generate version number
    const existingGenerations = await prisma.specBookGeneration.count({
      where: { specBookId: specBook.id }
    })
    const version = `${Math.floor(existingGenerations / 10) + 1}.${existingGenerations % 10}`

    // Create generation record
    const generation = await prisma.specBookGeneration.create({
      data: {
        specBookId: specBook.id,
        version,
        status: 'GENERATING',
        sectionsIncluded: JSON.stringify(selectedSections || []),
        roomsIncluded: JSON.stringify(selectedRooms || []),
        coverPageData: JSON.stringify(coverPageData),
        generatedById: session.user.id
      }
    })

    try {
      // Generate PDF
      const generationResult = await pdfGenerationService.generateSpecBook({
        projectId,
        coverPageData,
        selectedSections: processedSections,
        selectedRooms: processedRooms,
        generatedById: session.user.id
      })

      if (generationResult.success) {
        // Update generation record with success
        await prisma.specBookGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'COMPLETED',
            pdfUrl: generationResult.pdfUrl,
            fileSize: generationResult.fileSize,
            pageCount: generationResult.pageCount,
            completedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          generation: {
            id: generation.id,
            version,
            pdfUrl: generationResult.pdfUrl,
            fileSize: generationResult.fileSize,
            pageCount: generationResult.pageCount
          }
        })
      } else {
        // Update generation record with failure
        await prisma.specBookGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'FAILED',
            errorMessage: generationResult.error
          }
        })

        return NextResponse.json({
          success: false,
          error: generationResult.error
        }, { status: 500 })
      }

    } catch (error) {
      // Update generation record with failure
      await prisma.specBookGeneration.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      throw error
    }

  } catch (error) {
    console.error('Spec book generation API error:', error)
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
    RCP: 'Reflected Ceiling Plans'
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
    RCP: 6
  }
  return orders[sectionType] || 99
}