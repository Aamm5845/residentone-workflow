import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sectionId = params.sectionId

    // Check if section exists and user has access
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          room: {
            project: {
              // User must be part of organization or have appropriate role
              OR: [
                { createdBy: session.user.id },
                { 
                  stages: {
                    some: {
                      assignedTo: session.user.id
                    }
                  }
                }
              ]
            }
          }
        }
      },
      include: {
        items: {
          select: { id: true }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ 
        error: 'Section not found or access denied' 
      }, { status: 404 })
    }

    // Check if user has permission to delete sections
    // Only FFE specialists, admins, and owners should be able to delete sections
    if (!['FFE', 'ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to delete sections' 
      }, { status: 403 })
    }

    // Delete section (this will cascade delete all items in the section)
    await prisma.roomFFESection.delete({
      where: { id: sectionId }
    })

    return NextResponse.json({
      success: true,
      message: `Section deleted successfully. ${section.items.length} items were also removed.`
    })

  } catch (error) {
    console.error('Error deleting FFE section:', error)
    return NextResponse.json({ 
      error: 'Failed to delete FFE section' 
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
              OR: [
                { createdBy: session.user.id },
                { 
                  stages: {
                    some: {
                      assignedTo: session.user.id
                    }
                  }
                }
              ]
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