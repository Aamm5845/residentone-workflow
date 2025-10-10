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
    console.log('🗑️ DELETE /api/ffe/sections/[sectionId] - Getting session...')
    const session = await getServerSession(authOptions)
    console.log('🗑️ Session user:', session?.user?.email)
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId
    let userId = session.user.id
    
    if (!orgId || !userId) {
      console.log('⚠️ Missing user data, looking up from email:', session.user.email)
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true, role: true }
      })
      
      if (!user) {
        console.log('❌ User not found in database')
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      userId = user.id
      orgId = user.orgId
      console.log('✅ Retrieved user info:', { userId, orgId, role: user.role })
    }

    const sectionId = params.sectionId
    console.log('🗑️ Deleting section:', sectionId)

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
      console.log('❌ Section not found or access denied for orgId:', orgId)
      return NextResponse.json({ 
        error: 'Section not found or access denied' 
      }, { status: 404 })
    }
    
    console.log('✅ Section found:', section.name, 'with', section.items.length, 'items')

    // Delete section (this will cascade delete all items in the section)
    console.log('🗑️ Deleting section from database...')
    await prisma.roomFFESection.delete({
      where: { id: sectionId }
    })
    
    console.log('✅ Section deleted successfully:', section.name)
    return NextResponse.json({
      success: true,
      message: `Section "${section.name}" deleted successfully. ${section.items.length} items were also removed.`
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