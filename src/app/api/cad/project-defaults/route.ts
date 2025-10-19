import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Session } from 'next-auth'
import { 
  DEFAULT_CAD_PREFERENCES,
  CreateProjectCadDefaultsInput,
  VALID_PLOT_AREAS,
  VALID_SCALE_MODES,
  VALID_PAPER_SIZES,
  DPI_RANGE,
  SCALE_DENOMINATOR_RANGE
} from '@/types/cad-preferences'

// Validation schemas
const getProjectDefaultsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
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

const createProjectCadDefaultsSchema = z.object({
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
  message: "Invalid project defaults combination"
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

/**
 * Get project CAD defaults
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 })
    }

    // Validate the project exists and user has access
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Get project defaults
    const projectDefaults = await prisma.projectCadDefaults.findUnique({
      where: { projectId }
    })

    if (projectDefaults) {
      return NextResponse.json(projectDefaults)
    }

    // Return null if no defaults are set (frontend will show system defaults)
    return NextResponse.json(null)

  } catch (error) {
    console.error('Error getting project CAD defaults:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Create or update project CAD defaults
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createProjectCadDefaultsSchema.parse(body)

    // Verify the project exists and user has access
    const project = await prisma.project.findFirst({
      where: { 
        id: validatedData.projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Upsert project defaults (create or update)
    const defaults = await prisma.projectCadDefaults.upsert({
      where: { projectId: validatedData.projectId },
      create: {
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
        action: 'update_project_cad_defaults',
        entity: 'ProjectCadDefaults',
        entityId: defaults.id,
        details: {
          projectId: validatedData.projectId,
          changes: body
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({ 
      success: true, 
      defaults 
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Error creating/updating project CAD defaults:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Delete project CAD defaults (revert to system defaults)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 })
    }

    // Validate the project exists and user has access
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Delete project defaults
    const deletedDefaults = await prisma.projectCadDefaults.delete({
      where: { projectId }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'delete_project_cad_defaults',
        entity: 'ProjectCadDefaults',
        entityId: deletedDefaults.id,
        details: {
          projectId
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Project CAD defaults deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting project CAD defaults:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}