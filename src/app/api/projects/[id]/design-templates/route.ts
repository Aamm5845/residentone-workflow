import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'
import { 
  isValidIcon, 
  isValidColorTheme, 
  DefaultTemplates,
  LegacyTypeMapping 
} from '@/lib/design-icons'

// GET /api/projects/[id]/design-templates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)

    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized - invalid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      console.error('❌ Project not found:', { projectId, userId: session.user.id, orgId: session.user.orgId })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get project templates
    let templates = await prisma.designSectionTemplate.findMany({
      where: {
        projectId: projectId
      },
      orderBy: {
        order: 'asc'
      }
    })

    // If no templates exist, materialize the default templates for this project
    if (templates.length === 0) {
      console.log('📋 Creating default templates for project:', projectId)
      
      const defaultTemplates = DefaultTemplates.map((template, index) => ({
        projectId: projectId,
        name: template.name,
        icon: template.icon,
        color: template.color,
        description: template.description,
        placeholder: template.placeholder,
        order: index,
        createdById: session.user.id
      }))

      // Create default templates
      await prisma.designSectionTemplate.createMany({
        data: defaultTemplates
      })

      // Fetch the created templates
      templates = await prisma.designSectionTemplate.findMany({
        where: {
          projectId: projectId
        },
        orderBy: {
          order: 'asc'
        }
      })

      // Log activity
      await logActivity({
        session,
        action: ActivityActions.TEMPLATE_CREATED,
        entity: EntityTypes.PROJECT,
        entityId: projectId,
        details: {
          templateCount: templates.length,
          projectName: project.name,
          templatesCreated: templates.map(t => t.name)
        },
        ipAddress
      })
    }

    return NextResponse.json({
      success: true,
      templates: templates
    })

  } catch (error) {
    console.error('❌ Design Templates GET Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/projects/[id]/design-templates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)

    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized - invalid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { name, icon, color, description, placeholder, order } = await request.json()

    if (!name || !icon || !color) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, icon, and color are required' 
      }, { status: 400 })
    }

    // Validate icon and color
    if (!isValidIcon(icon)) {
      return NextResponse.json({
        error: `Invalid icon. Must be one of the supported Lucide icons.`
      }, { status: 400 })
    }

    if (!isValidColorTheme(color)) {
      return NextResponse.json({
        error: `Invalid color theme. Must be one of the supported gradient themes.`
      }, { status: 400 })
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      console.error('❌ Project not found:', { projectId, userId: session.user.id, orgId: session.user.orgId })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check for duplicate name within project
    const existingTemplate = await prisma.designSectionTemplate.findFirst({
      where: {
        projectId: projectId,
        name: name,
        isDeprecated: false
      }
    })

    if (existingTemplate) {
      return NextResponse.json({
        error: 'A template with this name already exists in this project'
      }, { status: 400 })
    }

    // Determine order if not provided
    const templateOrder = order !== undefined ? order : await getNextTemplateOrder(projectId)

    // Create new template
    const template = await prisma.designSectionTemplate.create({
      data: {
        projectId: projectId,
        name: name,
        icon: icon,
        color: color,
        description: description || null,
        placeholder: placeholder || null,
        order: templateOrder,
        createdById: session.user.id
      }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.TEMPLATE_CREATED,
      entity: EntityTypes.DESIGN_SECTION_TEMPLATE,
      entityId: template.id,
      details: {
        templateName: name,
        templateIcon: icon,
        templateColor: color,
        projectName: project.name,
        projectId: projectId
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      template: template
    })

  } catch (error) {
    console.error('❌ Design Templates POST Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to get the next template order
async function getNextTemplateOrder(projectId: string): Promise<number> {
  const lastTemplate = await prisma.designSectionTemplate.findFirst({
    where: {
      projectId: projectId
    },
    orderBy: {
      order: 'desc'
    },
    select: {
      order: true
    }
  })

  return (lastTemplate?.order || 0) + 1
}