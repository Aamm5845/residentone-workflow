import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/specs/all - Get all spec items for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Get user info to verify org access
    let orgId = session.user.orgId
    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms in the project with their FFE items
    const rooms = await prisma.room.findMany({
      where: { projectId },
      include: {
        ffeInstance: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  where: {
                    visibility: 'VISIBLE'
                  },
                  orderBy: { order: 'asc' },
                  include: {
                    images: {
                      orderBy: { order: 'asc' },
                      take: 1 // Just get the first image for preview
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Flatten all items from all rooms
    const allItems: Array<{
      id: string
      name: string
      specStatus: string
      roomName: string
      sectionName: string
      category?: string
      updatedAt: Date
      quantity?: number
      brand?: string
      supplierName?: string
      hasImage: boolean
    }> = []

    rooms.forEach(room => {
      if (!room.ffeInstance) return

      const roomName = room.name || room.type.replace(/_/g, ' ')

      room.ffeInstance.sections.forEach(section => {
        section.items.forEach(item => {
          // Extract custom fields
          const customFields = (item.customFields as any) || {}
          
          allItems.push({
            id: item.id,
            name: item.name,
            specStatus: item.specStatus || 'DRAFT',
            roomName,
            sectionName: section.name,
            category: customFields.category || undefined,
            updatedAt: item.updatedAt,
            quantity: item.quantity || undefined,
            brand: customFields.brand || item.brand || undefined,
            supplierName: item.supplierName || undefined,
            hasImage: (item.images && item.images.length > 0) || false
          })
        })
      })
    })

    // Sort by room name, then section name, then item name
    allItems.sort((a, b) => {
      if (a.roomName !== b.roomName) {
        return a.roomName.localeCompare(b.roomName)
      }
      if (a.sectionName !== b.sectionName) {
        return a.sectionName.localeCompare(b.sectionName)
      }
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      items: allItems,
      project: {
        id: project.id,
        name: project.name
      },
      stats: {
        total: allItems.length,
        active: allItems.filter(item => item.specStatus !== 'ARCHIVED').length,
        archived: allItems.filter(item => item.specStatus === 'ARCHIVED').length,
        specified: allItems.filter(item => item.specStatus === 'SPECIFIED').length,
        needsSpec: allItems.filter(item => item.specStatus === 'NEEDS_SPEC').length,
        draft: allItems.filter(item => item.specStatus === 'DRAFT').length
      }
    })

  } catch (error) {
    console.error('Error fetching project specs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project specs' },
      { status: 500 }
    )
  }
}