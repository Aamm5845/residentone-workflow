import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams

    // Find the item
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId: roomId
          }
        }
      },
      select: {
        id: true,
        visibility: true,
        name: true
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        itemId: item.id,
        visibility: item.visibility,
        name: item.name
      }
    })

  } catch (error) {
    console.error('Error getting item visibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    let userId = session.user.id
    if (!userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      })
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      userId = user.id
    }

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams
    const data = await request.json()
    const { visibility } = data

    if (!visibility || !['VISIBLE', 'HIDDEN'].includes(visibility)) {
      return NextResponse.json(
        { error: 'Invalid visibility value. Must be VISIBLE or HIDDEN' },
        { status: 400 }
      )
    }

    // Find and update the item
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId: roomId
          }
        }
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if this is a parent item with linked children
    const hasLinkedChildren = item.customFields && 
      (item.customFields as any).hasChildren === true
    
    // Update the parent item and all linked children if applicable
    if (hasLinkedChildren) {
      // Find all child items in the same section
      const childItems = await prisma.roomFFEItem.findMany({
        where: {
          sectionId: item.sectionId,
          customFields: {
            path: ['isLinkedItem'],
            equals: true
          },
          customFields: {
            path: ['parentName'],
            equals: item.name
          }
        }
      })
      
      // Update parent and all children in a transaction
      await prisma.$transaction([
        // Update parent
        prisma.roomFFEItem.update({
          where: { id: itemId },
          data: {
            visibility: visibility,
            updatedById: userId
          }
        }),
        // Update all children
        ...childItems.map(child =>
          prisma.roomFFEItem.update({
            where: { id: child.id },
            data: {
              visibility: visibility,
              updatedById: userId
            }
          })
        )
      ])
    } else {
      // Simple update for non-parent items
      await prisma.roomFFEItem.update({
        where: { id: itemId },
        data: {
          visibility: visibility,
          updatedById: userId
        }
      })
    }
    
    // Fetch the updated item with section info
    const updatedItem = await prisma.roomFFEItem.findUnique({
      where: { id: itemId },
      include: {
        section: {
          select: {
            name: true,
            instance: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    // Log the change
    await prisma.fFEChangeLog.create({
      data: {
        entityType: 'item',
        entityId: itemId,
        action: 'visibility_changed',
        fieldName: 'visibility',
        oldValue: item.visibility,
        newValue: visibility,
        userId: userId,
        orgId: item.section.instance.room.project.orgId,
        roomId: roomId,
        instanceId: item.section.instanceId,
        metadata: {
          itemName: item.name,
          sectionName: item.section.name,
          reason: visibility === 'HIDDEN' ? 'Removed from workspace' : 'Added to workspace'
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        itemId: updatedItem.id,
        visibility: updatedItem.visibility,
        name: updatedItem.name,
        section: updatedItem.section.name
      },
      message: `Item ${visibility === 'VISIBLE' ? 'added to' : 'removed from'} workspace`
    })

  } catch (error) {
    console.error('Error updating item visibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}