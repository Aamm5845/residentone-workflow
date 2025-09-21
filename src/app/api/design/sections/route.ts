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
    console.log('📝 Sections API called')
    
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    console.log('👤 Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      orgId: session?.user?.orgId
    })
    
    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized - invalid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId, type } = await request.json()
    
    console.log('📋 Request data:', { stageId, type })

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
    const stage = await prisma.stage.findFirst({
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
      console.error('❌ Stage not found:', { stageId, userId: session.user.id, orgId: session.user.orgId })
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }
    
    console.log('✅ Stage found:', { stageId: stage.id, type: stage.type })

    // Check if section already exists
    const existingSection = await prisma.designSection.findFirst({
      where: {
        stageId: stageId,
        type: type
      }
    })

    if (existingSection) {
      console.log('♾ Existing section found:', { sectionId: existingSection.id, type: existingSection.type })
      return NextResponse.json({
        success: true,
        section: existingSection
      })
    }
    
    console.log('🆕 Creating new section:', { stageId, type })

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
    console.error('❌ Sections API Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}