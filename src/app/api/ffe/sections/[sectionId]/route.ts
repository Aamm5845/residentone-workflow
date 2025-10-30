import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId
    let userId = session.user.id
    
    if (!orgId || !userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true, role: true }
      })
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      userId = user.id
      orgId = user.orgId
    }

    const sectionId = params.sectionId

    // Check if section exists and user has access
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          room: {
            project: {
              orgId: orgId
            }
          }
        }
      },
      include: {
        items: {
          select: { id: true }
        },
        instance: {
          include: {
            room: {
              include: {
                project: {
                  select: { name: true, orgId: true }
                }
              }
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ 
        error: 'Section not found or access denied' 
      }, { status: 404 })
    }
    
    // Delete section (this will cascade delete all items in the section due to onDelete: Cascade in schema)
    await prisma.roomFFESection.delete({
      where: { id: sectionId }
    })
    return NextResponse.json({
      success: true,
      message: `Section "${section.name}" and its ${section.items.length} item(s) deleted successfully.`
    })

  } catch (error) {
    console.error('❌ Error deleting FFE section:', error)
    console.error('❌ Error details:', {
      sectionId: params.sectionId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Failed to delete FFE section',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId
    
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      orgId = user?.orgId
    }

    const sectionId = params.sectionId
    const { name, description, order, isExpanded, isCompleted } = await request.json()

    // Check if section exists and user has access
    const existingSection = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          room: {
            project: {
              orgId: orgId
            }
          }
        }
      }
    })

    if (!existingSection) {
      return NextResponse.json({ 
        error: 'Section not found or access denied' 
      }, { status: 404 })
    }

    // Update section
    const updatedSection = await prisma.roomFFESection.update({
      where: { id: sectionId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(order !== undefined && { order }),
        ...(isExpanded !== undefined && { isExpanded }),
        ...(isCompleted !== undefined && { 
          isCompleted,
          completedAt: isCompleted ? new Date() : null
        }),
        updatedAt: new Date()
      },
      include: {
        items: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
        },
        templateSection: {
          select: {
            name: true,
            description: true,
            icon: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Section updated successfully',
      section: updatedSection
    })

  } catch (error) {
    console.error('Error updating FFE section:', error)
    return NextResponse.json({ 
      error: 'Failed to update FFE section' 
    }, { status: 500 })
  }
}