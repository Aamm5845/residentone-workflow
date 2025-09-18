import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { sectionType, content, isComplete, action } = data

    // Find the stage and verify access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        designSections: true,
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

    // Find or create the design section
    let designSection = stage.designSections?.find(section => section.type === sectionType)
    
    if (designSection) {
      // Update existing section
      const updateData: any = {}
      if (content !== undefined) updateData.content = content
      if (action === 'mark_complete' && isComplete !== undefined) updateData.completed = isComplete
      
      designSection = await prisma.designSection.update({
        where: { id: designSection.id },
        data: updateData
      })
    } else {
      // Create new section
      designSection = await prisma.designSection.create({
        data: {
          stageId: stage.id,
          type: sectionType,
          content: content || '',
          completed: isComplete || false
        }
      })
    }

    // Get updated stage with all sections
    const updatedStage = await prisma.stage.findUnique({
      where: { id: stage.id },
      include: {
        designSections: {
          include: {
            assets: true,
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: true
          }
        }
      }
    })

    return NextResponse.json(updatedStage)
  } catch (error) {
    console.error('Error updating design section:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
