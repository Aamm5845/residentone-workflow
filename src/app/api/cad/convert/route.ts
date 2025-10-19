import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Session } from 'next-auth'
import { enhancedCADConversionService } from '@/lib/cad-conversion-enhanced'
import { dropboxService } from '@/lib/dropbox-service'
import { 
  EffectiveCadPreferences, 
  DEFAULT_CAD_PREFERENCES,
  CadConversionResult,
  CadConversionProgress
} from '@/types/cad-preferences'

// Validation schema
const convertCadSchema = z.object({
  linkedFileId: z.string().min(1, "Linked file ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  useStoredPreferences: z.boolean().optional().default(true),
  // Optional: provide preferences inline (overrides stored preferences)
  preferences: z.object({
    layoutName: z.string().nullable().optional(),
    ctbDropboxPath: z.string().nullable().optional(),
    ctbFileId: z.string().nullable().optional(),
    plotArea: z.string().optional(),
    window: z.object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number()
    }).nullable().optional(),
    centerPlot: z.boolean().optional(),
    scaleMode: z.string().optional(),
    scaleDenominator: z.number().nullable().optional(),
    keepAspectRatio: z.boolean().optional(),
    margins: z.object({
      top: z.number().min(0),
      right: z.number().min(0),
      bottom: z.number().min(0),
      left: z.number().min(0)
    }).nullable().optional(),
    paperSize: z.string().nullable().optional(),
    orientation: z.string().nullable().optional(),
    dpi: z.number().nullable().optional()
  }).optional()
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

/**
 * Convert a CAD file to PDF using stored or provided preferences
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = convertCadSchema.parse(body)

    // Validate the file exists and user has access
    const linkedFile = await prisma.dropboxFileLink.findFirst({
      where: { 
        id: validatedData.linkedFileId,
        section: {
          specBook: {
            project: {
              id: validatedData.projectId,
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        section: {
          include: {
            specBook: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!linkedFile) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Get effective preferences
    let effectivePrefs: EffectiveCadPreferences

    if (validatedData.useStoredPreferences) {
      // Use stored preferences (file > project > system defaults)
      const projectId = linkedFile.section.specBook.projectId

      // 1. Try per-file preferences
      const filePreferences = await prisma.cadPreferences.findUnique({
        where: { linkedFileId: validatedData.linkedFileId }
      })

      if (filePreferences) {
        effectivePrefs = {
          layoutName: filePreferences.layoutName,
          ctbDropboxPath: filePreferences.ctbDropboxPath,
          ctbFileId: filePreferences.ctbFileId,
          plotArea: filePreferences.plotArea as any,
          window: filePreferences.window as any,
          centerPlot: filePreferences.centerPlot,
          scaleMode: filePreferences.scaleMode as any,
          scaleDenominator: filePreferences.scaleDenominator,
          keepAspectRatio: filePreferences.keepAspectRatio,
          margins: filePreferences.margins as any || DEFAULT_CAD_PREFERENCES.margins,
          paperSize: filePreferences.paperSize as any || DEFAULT_CAD_PREFERENCES.paperSize,
          orientation: filePreferences.orientation as any,
          dpi: filePreferences.dpi || DEFAULT_CAD_PREFERENCES.dpi,
          source: 'file'
        }
      } else {
        // 2. Try project defaults
        const projectDefaults = await prisma.projectCadDefaults.findUnique({
          where: { projectId }
        })

        if (projectDefaults) {
          effectivePrefs = {
            layoutName: projectDefaults.layoutName,
            ctbDropboxPath: projectDefaults.ctbDropboxPath,
            ctbFileId: projectDefaults.ctbFileId,
            plotArea: projectDefaults.plotArea as any,
            window: projectDefaults.window as any,
            centerPlot: projectDefaults.centerPlot,
            scaleMode: projectDefaults.scaleMode as any,
            scaleDenominator: projectDefaults.scaleDenominator,
            keepAspectRatio: projectDefaults.keepAspectRatio,
            margins: projectDefaults.margins as any || DEFAULT_CAD_PREFERENCES.margins,
            paperSize: projectDefaults.paperSize as any || DEFAULT_CAD_PREFERENCES.paperSize,
            orientation: projectDefaults.orientation as any,
            dpi: projectDefaults.dpi || DEFAULT_CAD_PREFERENCES.dpi,
            source: 'project'
          }
        } else {
          // 3. Use system defaults
          effectivePrefs = {
            ...DEFAULT_CAD_PREFERENCES,
            source: 'system'
          }
        }
      }
    } else if (validatedData.preferences) {
      // Use provided preferences
      effectivePrefs = {
        layoutName: validatedData.preferences.layoutName ?? DEFAULT_CAD_PREFERENCES.layoutName,
        ctbDropboxPath: validatedData.preferences.ctbDropboxPath ?? DEFAULT_CAD_PREFERENCES.ctbDropboxPath,
        ctbFileId: validatedData.preferences.ctbFileId ?? DEFAULT_CAD_PREFERENCES.ctbFileId,
        plotArea: validatedData.preferences.plotArea as any ?? DEFAULT_CAD_PREFERENCES.plotArea,
        window: validatedData.preferences.window ?? DEFAULT_CAD_PREFERENCES.window,
        centerPlot: validatedData.preferences.centerPlot ?? DEFAULT_CAD_PREFERENCES.centerPlot,
        scaleMode: validatedData.preferences.scaleMode as any ?? DEFAULT_CAD_PREFERENCES.scaleMode,
        scaleDenominator: validatedData.preferences.scaleDenominator ?? DEFAULT_CAD_PREFERENCES.scaleDenominator,
        keepAspectRatio: validatedData.preferences.keepAspectRatio ?? DEFAULT_CAD_PREFERENCES.keepAspectRatio,
        margins: validatedData.preferences.margins ?? DEFAULT_CAD_PREFERENCES.margins,
        paperSize: validatedData.preferences.paperSize as any ?? DEFAULT_CAD_PREFERENCES.paperSize,
        orientation: validatedData.preferences.orientation as any ?? DEFAULT_CAD_PREFERENCES.orientation,
        dpi: validatedData.preferences.dpi ?? DEFAULT_CAD_PREFERENCES.dpi,
        source: 'inline'
      }
    } else {
      // Fallback to system defaults
      effectivePrefs = {
        ...DEFAULT_CAD_PREFERENCES,
        source: 'system'
      }
    }

    // Validate preferences
    const validation = enhancedCADConversionService.validatePreferences(effectivePrefs)
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid preferences', 
        details: validation.errors 
      }, { status: 400 })
    }

    // Get file metadata for revision
    const fileMetadata = await dropboxService.getFileMetadata(linkedFile.dropboxPath)
    if (!fileMetadata) {
      return NextResponse.json({ error: 'File not found in Dropbox' }, { status: 404 })
    }

    // Get CTB file buffer if specified
    let ctbFileBuffer: Buffer | undefined
    if (effectivePrefs.ctbDropboxPath) {
      try {
        ctbFileBuffer = await dropboxService.downloadFile(effectivePrefs.ctbDropboxPath)
      } catch (error) {
        console.warn('Failed to download CTB file:', error)
        // Continue without CTB rather than failing
      }
    }

    // Start conversion
    let progressCallback: ((progress: CadConversionProgress) => void) | undefined
    
    // For real-time progress, you could implement SSE or WebSocket here
    // For now, we'll just log progress
    progressCallback = (progress: CadConversionProgress) => {
      console.log(`Conversion progress: ${progress.status} - ${progress.progress}% - ${progress.message}`)
    }

    const conversionResult = await enhancedCADConversionService.convertCADToPDF({
      dropboxPath: linkedFile.dropboxPath,
      revision: fileMetadata.revision,
      preferences: effectivePrefs,
      ctbFileBuffer,
      onProgress: progressCallback
    })

    // Log the conversion activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'convert_cad_file',
        entity: 'DropboxFileLink',
        entityId: validatedData.linkedFileId,
        details: {
          dropboxPath: linkedFile.dropboxPath,
          preferences: effectivePrefs,
          result: {
            success: conversionResult.success,
            cached: conversionResult.cached,
            cost: conversionResult.cost,
            processingTime: conversionResult.processingTime,
            fileSize: conversionResult.fileSize
          }
        },
        orgId: session.user.orgId
      }
    })

    // Update file cache URL if conversion was successful
    if (conversionResult.success && conversionResult.pdfUrl) {
      await prisma.dropboxFileLink.update({
        where: { id: validatedData.linkedFileId },
        data: {
          cadToPdfCacheUrl: conversionResult.pdfUrl,
          cacheExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      })
    }

    return NextResponse.json({
      success: true,
      result: conversionResult,
      preferencesUsed: {
        source: effectivePrefs.source,
        layoutName: effectivePrefs.layoutName,
        ctbUsed: !!effectivePrefs.ctbDropboxPath,
        scaleMode: effectivePrefs.scaleMode,
        paperSize: effectivePrefs.paperSize
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Error converting CAD file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}