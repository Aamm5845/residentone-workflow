import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Session } from 'next-auth'
import { 
  EffectiveCadPreferences, 
  DEFAULT_CAD_PREFERENCES,
  CreateCadPreferencesInput,
  VALID_PLOT_AREAS,
  VALID_SCALE_MODES,
  VALID_PAPER_SIZES,
  VALID_ORIENTATIONS,
  DPI_RANGE,
  SCALE_DENOMINATOR_RANGE
} from '@/types/cad-preferences'

// Validation schemas
const getCadPreferencesSchema = z.object({
  fileId: z.string().min(1, "File ID is required")
})

const windowCoordinatesSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number()
}).refine(data => data.x1 < data.x2 && data.y1 < data.y2, {
  message: "Invalid window coordinates: x1 must be less than x2, y1 must be less than y2"
})

const marginsSchema = z.object({
  top: z.number().min(0),
  right: z.number().min(0),
  bottom: z.number().min(0),
  left: z.number().min(0)
})

const createCadPreferencesSchema = z.object({
  linkedFileId: z.string().min(1, "Linked file ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  layoutName: z.string().nullable().optional(),
  ctbDropboxPath: z.string().nullable().optional(),
  ctbFileId: z.string().nullable().optional(),
  plotArea: z.enum(VALID_PLOT_AREAS as [string, ...string[]]).optional(),
  window: windowCoordinatesSchema.nullable().optional(),
  centerPlot: z.boolean().optional(),
  scaleMode: z.enum(VALID_SCALE_MODES as [string, ...string[]]).optional(),
  scaleDenominator: z.number()
    .min(SCALE_DENOMINATOR_RANGE.min)
    .max(SCALE_DENOMINATOR_RANGE.max)
    .nullable().optional(),
  keepAspectRatio: z.boolean().optional(),
  margins: marginsSchema.nullable().optional(),
  paperSize: z.enum(VALID_PAPER_SIZES as [string, ...string[]]).nullable().optional(),
  orientation: z.enum(['portrait', 'landscape'] as const).nullable().optional(),
  dpi: z.number()
    .min(DPI_RANGE.min)
    .max(DPI_RANGE.max)
    .nullable().optional()
}).refine(data => {
  // If plot area is window, window coordinates must be provided
  if (data.plotArea === 'window' && !data.window) {
    return false
  }
  // If scale mode is custom, scale denominator must be provided
  if (data.scaleMode === 'custom' && !data.scaleDenominator) {
    return false
  }
  return true
}, {
  message: "Invalid preferences combination"
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

/**
 * Get effective preferences for a CAD file (file > project > system defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId query parameter is required' }, { status: 400 })
    }

    // Validate the file ID exists and user has access
    const linkedFile = await prisma.dropboxFileLink.findFirst({
      where: { 
        id: fileId,
        section: {
          specBook: {
            project: {
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

    const projectId = linkedFile.section.specBook.projectId

    // 1. Try to get per-file preferences
    const filePreferences = await prisma.cadPreferences.findUnique({
      where: { linkedFileId: fileId }
    })

    if (filePreferences) {
      const effectivePrefs: EffectiveCadPreferences = {
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
      return NextResponse.json(effectivePrefs)
    }

    // 2. Try to get project defaults
    const projectDefaults = await prisma.projectCadDefaults.findUnique({
      where: { projectId }
    })

    if (projectDefaults) {
      const effectivePrefs: EffectiveCadPreferences = {
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
      return NextResponse.json(effectivePrefs)
    }

    // 3. Return system defaults
    const effectivePrefs: EffectiveCadPreferences = {
      ...DEFAULT_CAD_PREFERENCES,
      source: 'system'
    }
    
    return NextResponse.json(effectivePrefs)

  } catch (error) {
    console.error('Error getting CAD preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Create or update per-file CAD preferences
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createCadPreferencesSchema.parse(body)

    // Verify the file exists and user has access
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
      }
    })

    if (!linkedFile) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Upsert preferences (create or update)
    const preferences = await prisma.cadPreferences.upsert({
      where: { linkedFileId: validatedData.linkedFileId },
      create: {
        linkedFileId: validatedData.linkedFileId,
        projectId: validatedData.projectId,
        layoutName: validatedData.layoutName,
        ctbDropboxPath: validatedData.ctbDropboxPath,
        ctbFileId: validatedData.ctbFileId,
        plotArea: validatedData.plotArea || DEFAULT_CAD_PREFERENCES.plotArea,
        window: validatedData.window,
        centerPlot: validatedData.centerPlot ?? DEFAULT_CAD_PREFERENCES.centerPlot,
        scaleMode: validatedData.scaleMode || DEFAULT_CAD_PREFERENCES.scaleMode,
        scaleDenominator: validatedData.scaleDenominator,
        keepAspectRatio: validatedData.keepAspectRatio ?? DEFAULT_CAD_PREFERENCES.keepAspectRatio,
        margins: validatedData.margins || DEFAULT_CAD_PREFERENCES.margins,
        paperSize: validatedData.paperSize || DEFAULT_CAD_PREFERENCES.paperSize,
        orientation: validatedData.orientation,
        dpi: validatedData.dpi || DEFAULT_CAD_PREFERENCES.dpi
      },
      update: {
        layoutName: validatedData.layoutName,
        ctbDropboxPath: validatedData.ctbDropboxPath,
        ctbFileId: validatedData.ctbFileId,
        plotArea: validatedData.plotArea || DEFAULT_CAD_PREFERENCES.plotArea,
        window: validatedData.window,
        centerPlot: validatedData.centerPlot ?? DEFAULT_CAD_PREFERENCES.centerPlot,
        scaleMode: validatedData.scaleMode || DEFAULT_CAD_PREFERENCES.scaleMode,
        scaleDenominator: validatedData.scaleDenominator,
        keepAspectRatio: validatedData.keepAspectRatio ?? DEFAULT_CAD_PREFERENCES.keepAspectRatio,
        margins: validatedData.margins || DEFAULT_CAD_PREFERENCES.margins,
        paperSize: validatedData.paperSize || DEFAULT_CAD_PREFERENCES.paperSize,
        orientation: validatedData.orientation,
        dpi: validatedData.dpi || DEFAULT_CAD_PREFERENCES.dpi,
        updatedAt: new Date()
      }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'update_cad_preferences',
        entity: 'CadPreferences',
        entityId: preferences.id,
        details: {
          linkedFileId: validatedData.linkedFileId,
          changes: body
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({ 
      success: true, 
      preferences 
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Error creating/updating CAD preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
