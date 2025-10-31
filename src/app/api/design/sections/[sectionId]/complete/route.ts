import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

interface RequestParams {
  params: Promise<{
    sectionId: string
  }>
}

export async function PATCH(request: NextRequest, { params }: RequestParams) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sectionId } = await params
    const { completed } = await request.json()

    if (typeof completed !== 'boolean') {
      return NextResponse.json({ 
        error: 'Invalid completion status. Must be true or false.' 
      }, { status: 400 })
    }

    // Find the section and verify access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Update the completion status
    const updatedSection = await prisma.designSection.update({
      where: { id: sectionId },
      data: withUpdateAttribution(session, { 
        completed,
        completedById: completed ? session.user.id : null
      }),
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        },
        assets: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, role: true }
            }
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: completed ? ActivityActions.SECTION_COMPLETED : ActivityActions.SECTION_REOPENED,
      entity: EntityTypes.SECTION,
      entityId: section.id,
      details: {
        sectionType: section.type,
        sectionName: getSectionName(section.type),
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name,
        completed: completed
      },
      ipAddress
    })

    // Calculate overall completion for the stage
    const allSections = await prisma.designSection.findMany({
      where: { stageId: section.stageId }
    })
    
    const completedCount = allSections.filter(s => s.completed).length
    const totalCount = allSections.length
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return NextResponse.json({
      success: true,
      section: updatedSection,
      completion: {
        percentage: completionPercentage,
        completedSections: completedCount,
        totalSections: totalCount
      }
    })

  } catch (error) {
    console.error('Error updating section completion:', error)
    return NextResponse.json({ 
      error: 'Failed to update section completion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getSectionName(sectionType: string): string {
  switch (sectionType) {
    case 'GENERAL': return 'General Design'
    case 'WALL_COVERING': return 'Wall Covering'
    case 'CEILING': return 'Ceiling Design'
    case 'FLOOR': return 'Floor Design'
    default: return 'Design Section'
  }
}