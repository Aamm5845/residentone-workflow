import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { pdfGenerationService } from '@/lib/pdf-generation'
import { cadConversionService } from '@/lib/cad-conversion'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { CadPreferences } from '@/types/cad'

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
    console.log(`[DEBUG] Processing ${(selectedSections || []).length} project-level sections`)
    for (const sectionType of selectedSections || []) {
      // Create or update section
      let section = await prisma.specBookSection.findFirst({
        where: {
          specBookId: specBook.id,
          type: sectionType,
          roomId: null
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
        section = await prisma.specBookSection.create({
          data: {
            specBookId: specBook.id,
            type: sectionType,
            name: getSectionDisplayName(sectionType),
            roomId: null,
            order: getDefaultSectionOrder(sectionType)
          },
          include: {
            dropboxFiles: {
              where: {
                isActive: true
              }
            }
          }
        })
      }
      
      console.log(`[DEBUG] Section ${sectionType} has ${section.dropboxFiles?.length || 0} files`)
      section.dropboxFiles?.forEach((file, index) => {
        console.log(`[DEBUG] Section file ${index + 1}: ${file.fileName}, cached: ${file.cadToPdfCacheUrl ? 'YES' : 'NO'}, fileId: ${file.dropboxFileId}`)
      })
      
      // Process CAD files for project-level sections (convert if not cached)
      for (const dropboxFile of section.dropboxFiles || []) {
        if (!dropboxFile.cadToPdfCacheUrl) {
          // Convert CAD file if not cached
          try {
            console.log(`[CAD-Conversion] Converting project-level ${dropboxFile.fileName} from ${dropboxFile.dropboxPath}`)
            // Use the path for shared link download (prefer path over ID)
            const downloadPath = dropboxFile.dropboxPath || dropboxFile.dropboxFileId
            const fileBuffer = await dropboxService.downloadFile(downloadPath)
            
            // Load effective CAD preferences for this file
            const preferences = await getEffectiveCadPreferences(dropboxFile.id, projectId)
            
            const conversionResult = await cadConversionService.convertCADToPDFWithPreferences(
              dropboxFile.dropboxPath,
              dropboxFile.dropboxRevision || '',
              fileBuffer,
              preferences
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
              
              console.log(`[CAD-Conversion] Successfully converted and cached ${dropboxFile.fileName}`)
              // Update the section object with the new cache URL
              dropboxFile.cadToPdfCacheUrl = conversionResult.pdfUrl
            }
          } catch (error) {
            console.error(`[CAD-Conversion] Failed to convert project-level CAD file ${dropboxFile.fileName}:`, error)
            // Continue without this file
          }
        } else {
          console.log(`[CAD-Conversion] Using cached PDF for ${dropboxFile.fileName}`)
        }
      }

      // Only add section if it has files with successful conversions or cached PDFs
      const sectionsWithContent = section.dropboxFiles?.filter(file => file.cadToPdfCacheUrl) || []
      if (sectionsWithContent.length > 0) {
        // Update section to only include files with content
        section.dropboxFiles = sectionsWithContent
        processedSections.push(section)
        console.log(`[DEBUG] Added section ${section.name} with ${sectionsWithContent.length} converted files`)
      } else {
        console.log(`[DEBUG] Skipped empty section ${section.name} (no converted CAD files)`)
      }
    }

    // Process selected rooms - maintain order from frontend
    console.log('[PDF-Generation] Selected rooms order from frontend:', selectedRooms)
    const processedRooms = []
    for (const roomId of selectedRooms || []) {
      const room = project.rooms.find(r => r.id === roomId)
      if (!room) continue

      // Get room's spec book sections (both ROOM and DRAWINGS)
      const roomSections = await prisma.specBookSection.findMany({
        where: {
          specBookId: specBook.id,
          roomId: roomId,
          type: {
            in: ['ROOM', 'DRAWINGS']
          }
        },
        include: {
          dropboxFiles: {
            where: {
              isActive: true
            }
          }
        }
      });

      let roomSection = roomSections.find(s => s.type === 'ROOM')
      let drawingsSection = roomSections.find(s => s.type === 'DRAWINGS')

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

      // Process CAD files for this room (from both ROOM and DRAWINGS sections)
      const cadFiles = []
      const allDropboxFiles = [
        ...(roomSection?.dropboxFiles || []),
        ...(drawingsSection?.dropboxFiles || [])
      ]
      
      console.log(`[DEBUG] Processing ${allDropboxFiles.length} dropbox files for room ${room.name}`)
      allDropboxFiles.forEach((file, index) => {
        console.log(`[DEBUG] File ${index + 1}: ${file.fileName}, cached: ${file.cadToPdfCacheUrl ? 'YES' : 'NO'}, fileId: ${file.dropboxFileId}`)
      })
      
      for (const dropboxFile of allDropboxFiles) {
        if (dropboxFile.cadToPdfCacheUrl) {
          cadFiles.push({
            fileName: dropboxFile.fileName,
            pdfUrl: dropboxFile.cadToPdfCacheUrl
          })
        } else {
          // Convert CAD file if not cached
          try {
            console.log(`[CAD-Conversion] Converting ${dropboxFile.fileName} from ${dropboxFile.dropboxPath}`)
            // Use the path for shared link download (prefer path over ID)
            const downloadPath = dropboxFile.dropboxPath || dropboxFile.dropboxFileId
            const fileBuffer = await dropboxService.downloadFile(downloadPath)
            
            // Load effective CAD preferences for this file
            const preferences = await getEffectiveCadPreferences(dropboxFile.id, projectId)
            
            const conversionResult = await cadConversionService.convertCADToPDFWithPreferences(
              dropboxFile.dropboxPath,
              dropboxFile.dropboxRevision || '',
              fileBuffer,
              preferences
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

      // Get all rendering URLs (support both new array and legacy single URL)
      const renderingUrls = roomSection.renderingUrls && roomSection.renderingUrls.length > 0
        ? roomSection.renderingUrls
        : roomSection.renderingUrl ? [roomSection.renderingUrl] : []
      
      // Only add room if it has content (CAD files or rendering)
      if (cadFiles.length > 0 || renderingUrls.length > 0) {
        processedRooms.push({
          id: room.id,
          name: room.name || room.type.replace('_', ' '),
          type: room.type,
          renderingUrl: roomSection.renderingUrl, // Keep for backward compatibility
          renderingUrls: renderingUrls,
          cadFiles
        })
        console.log(`[DEBUG] Added room ${room.name} with ${cadFiles.length} CAD files and ${renderingUrls.length} rendering(s)`)
      } else {
        console.log(`[DEBUG] Skipped empty room ${room.name} (no CAD files or rendering)`)
      }
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
      console.log(`[DEBUG] Starting PDF generation with:`)
      console.log(`[DEBUG] - ${processedSections.length} sections`)
      console.log(`[DEBUG] - ${processedRooms.length} rooms`)
      processedSections.forEach(section => {
        console.log(`[DEBUG] Section ${section.name}: ${section.dropboxFiles?.length || 0} files`)
      })
      
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
    console.error('😱 Spec book generation API error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Gets effective CAD preferences for a dropbox file, falling back to project defaults
 * and then system defaults if no preferences are found
 */
async function getEffectiveCadPreferences(
  dropboxFileId: string,
  projectId: string
): Promise<CadPreferences> {
  try {
    // First check for per-file preferences
    const filePrefs = await prisma.cadPreferences.findUnique({
      where: { dropboxFileId }
    })
    
    if (filePrefs) {
      return {
        layoutName: filePrefs.layoutName,
        ctbPath: filePrefs.ctbPath,
        ctbFileId: filePrefs.ctbFileId,
        plotArea: filePrefs.plotArea as 'extents' | 'display' | 'limits' | 'window',
        window: filePrefs.window as { xmin: number; ymin: number; xmax: number; ymax: number } | null,
        centerPlot: filePrefs.centerPlot,
        scaleMode: filePrefs.scaleMode as 'fit' | 'custom',
        scaleNumerator: filePrefs.scaleNumerator,
        scaleDenominator: filePrefs.scaleDenominator,
        keepAspectRatio: filePrefs.keepAspectRatio,
        margins: filePrefs.margins as { top: number; right: number; bottom: number; left: number } | null,
        paperSize: filePrefs.paperSize,
        orientation: filePrefs.orientation as 'portrait' | 'landscape' | null,
        dpi: filePrefs.dpi
      }
    }
    
    // Fallback to project defaults
    const projectDefaults = await prisma.projectCadDefaults.findUnique({
      where: { projectId }
    })
    
    if (projectDefaults) {
      return {
        layoutName: projectDefaults.layoutName,
        ctbPath: projectDefaults.ctbPath,
        ctbFileId: projectDefaults.ctbFileId,
        plotArea: projectDefaults.plotArea as 'extents' | 'display' | 'limits' | 'window',
        window: projectDefaults.window as { xmin: number; ymin: number; xmax: number; ymax: number } | null,
        centerPlot: projectDefaults.centerPlot,
        scaleMode: projectDefaults.scaleMode as 'fit' | 'custom',
        scaleNumerator: projectDefaults.scaleNumerator,
        scaleDenominator: projectDefaults.scaleDenominator,
        keepAspectRatio: projectDefaults.keepAspectRatio,
        margins: projectDefaults.margins as { top: number; right: number; bottom: number; left: number } | null,
        paperSize: projectDefaults.paperSize,
        orientation: projectDefaults.orientation as 'portrait' | 'landscape' | null,
        dpi: projectDefaults.dpi
      }
    }
    
    // System defaults (backward compatible with existing behavior)
    return {
      layoutName: null, // Use first/default layout
      ctbPath: null,
      ctbFileId: null,
      plotArea: 'extents',
      window: null,
      centerPlot: true,
      scaleMode: 'fit', // fit_to_page: true
      scaleNumerator: null,
      scaleDenominator: null,
      keepAspectRatio: true,
      margins: null,
      paperSize: null, // Auto
      orientation: null, // Auto
      dpi: null // Default
    }
  } catch (error) {
    console.error('Error loading CAD preferences, using system defaults:', error)
    // Return system defaults on error
    return {
      layoutName: null,
      ctbPath: null,
      ctbFileId: null,
      plotArea: 'extents',
      window: null,
      centerPlot: true,
      scaleMode: 'fit',
      scaleNumerator: null,
      scaleDenominator: null,
      keepAspectRatio: true,
      margins: null,
      paperSize: null,
      orientation: null,
      dpi: null
    }
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
