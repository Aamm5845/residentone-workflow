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
  isValidColorTheme
} from '@/lib/design-icons'

// PUT /api/projects/[id]/design-templates/[templateId]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, templateId: string } }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)

    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized - invalid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, templateId } = params
    const { name, icon, color, description, placeholder, order } = await request.json()

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

    // Verify template exists and belongs to this project
    const existingTemplate = await prisma.designSectionTemplate.findFirst({
      where: {
        id: templateId,
        projectId: projectId
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}
    
    if (name !== undefined) {
      // Check for duplicate name within project (excluding current template)
      const duplicateTemplate = await prisma.designSectionTemplate.findFirst({
        where: {
          projectId: projectId,
          name: name,
          isDeprecated: false,
          id: { not: templateId }
        }
      })

      if (duplicateTemplate) {
        return NextResponse.json({
          error: 'A template with this name already exists in this project'
        }, { status: 400 })
      }

      updateData.name = name
    }

    if (icon !== undefined) {
      if (!isValidIcon(icon)) {
        return NextResponse.json({
          error: `Invalid icon. Must be one of the supported Lucide icons.`
        }, { status: 400 })
      }
      updateData.icon = icon
    }

    if (color !== undefined) {
      if (!isValidColorTheme(color)) {
        return NextResponse.json({
          error: `Invalid color theme. Must be one of the supported gradient themes.`
        }, { status: 400 })
      }
      updateData.color = color
    }

    if (description !== undefined) {
      updateData.description = description || null
    }

    if (placeholder !== undefined) {
      updateData.placeholder = placeholder || null
    }

    if (order !== undefined) {
      updateData.order = order
    }

    // Update template
    const updatedTemplate = await prisma.designSectionTemplate.update({
      where: {
        id: templateId
      },
      data: updateData
    })

    // Log activity
    await logActivity({
      session,
      action: order !== undefined && order !== existingTemplate.order 
        ? ActivityActions.TEMPLATE_REORDERED 
        : ActivityActions.TEMPLATE_UPDATED,
      entity: EntityTypes.DESIGN_SECTION_TEMPLATE,
      entityId: templateId,
      details: {
        templateName: updatedTemplate.name,
        projectName: project.name,
        projectId: projectId,
        changes: Object.keys(updateData),
        oldOrder: existingTemplate.order,
        newOrder: updatedTemplate.order
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      template: updatedTemplate
    })

  } catch (error) {
    console.error('❌ Design Template PUT Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/design-templates/[templateId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, templateId: string } }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)

    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized - invalid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, templateId } = params

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

    // Verify template exists and belongs to this project
    const template = await prisma.designSectionTemplate.findFirst({
      where: {
        id: templateId,
        projectId: projectId
      },
      include: {
        _count: {
          select: {
            DesignSection: true
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const isTemplateInUse = template._count.DesignSection > 0

    let deletedTemplate
    if (isTemplateInUse) {
      // Soft delete: mark as deprecated
      deletedTemplate = await prisma.designSectionTemplate.update({
        where: {
          id: templateId
        },
        data: {
          isDeprecated: true
        }
      })
    } else {
      // Hard delete: actually remove from database
      deletedTemplate = await prisma.designSectionTemplate.delete({
        where: {
          id: templateId
        }
      })
    }

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.TEMPLATE_DELETED,
      entity: EntityTypes.DESIGN_SECTION_TEMPLATE,
      entityId: templateId,
      details: {
        templateName: template.name,
        projectName: project.name,
        projectId: projectId,
        softDelete: isTemplateInUse,
        sectionsUsingTemplate: template._count.DesignSection
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      template: deletedTemplate,
      softDeleted: isTemplateInUse,
      message: isTemplateInUse 
        ? 'Template marked as deprecated since it is being used by existing sections'
        : 'Template deleted successfully'
    })

  } catch (error) {
    console.error('❌ Design Template DELETE Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}