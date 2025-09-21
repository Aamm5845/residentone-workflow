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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId, type } = await request.json()

    if (!stageId || !type) {
      return NextResponse.json({ 
        error: 'Missing required fields: stageId and type' 
      }, { status: 400 })
    }

    // Validate section type
    const allowedTypes = ['GENERAL', 'WALL_COVERING', 'CEILING', 'FLOOR']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({
        error: `Invalid section type. Allowed types: ${allowedTypes.join(', ')}`
      }, { status: 400 })
    }

    // Verify stage exists and user has access
    const stage = await prisma.designStage.findFirst({
      where: {
        id: stageId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Check if section already exists
    const existingSection = await prisma.designSection.findFirst({
      where: {
        stageId: stageId,
        type: type
      }
    })

    if (existingSection) {
      return NextResponse.json({
        success: true,
        section: existingSection
      })
    }

    // Create new section
    const section = await prisma.designSection.create({
      data: {
        type: type,
        content: '',
        completed: false,
        stage: {
          connect: {
            id: stageId
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.SECTION_CREATED,
      entity: EntityTypes.DESIGN_SECTION,
      entityId: section.id,
      details: {
        sectionType: type,
        stageName: `${stage.type} - ${stage.room.name || stage.room.type}`,
        projectName: stage.room.project.name
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      section: section
    })

  } catch (error) {
    console.error('Error creating section:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}