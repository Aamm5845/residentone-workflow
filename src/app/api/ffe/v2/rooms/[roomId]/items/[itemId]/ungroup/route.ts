import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/ungroup
 * Ungroup an item - remove parent-child relationship, making it a standalone item
 */
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
    if (!userId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 404 })
    }

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams

    // Find the item to ungroup
    const childItem = await prisma.roomFFEItem.findFirst({
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

    if (!childItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const customFields = (childItem.customFields as any) || {}

    // Check if this is actually a grouped item
    if (!customFields.isGroupedItem && !customFields.isLinkedItem) {
      return NextResponse.json(
        { error: 'This item is not grouped with a parent' },
        { status: 400 }
      )
    }

    const parentId = customFields.parentId
    const parentName = customFields.parentName

    // Find the parent item to update its linkedItems array
    let parentItem = null
    if (parentId) {
      parentItem = await prisma.roomFFEItem.findFirst({
        where: { id: parentId }
      })
    } else if (parentName) {
      // Fallback to finding by name (legacy)
      parentItem = await prisma.roomFFEItem.findFirst({
        where: {
          name: parentName,
          section: {
            instance: {
              roomId: roomId
            }
          },
          customFields: {
            path: ['hasChildren'],
            equals: true
          }
        }
      })
    }

    // Perform transaction: update child + update parent
    const result = await prisma.$transaction(async (tx) => {
      // Remove grouping fields from the child item
      const updatedChildCustomFields = { ...customFields }
      delete updatedChildCustomFields.isGroupedItem
      delete updatedChildCustomFields.isLinkedItem
      delete updatedChildCustomFields.parentId
      delete updatedChildCustomFields.parentName

      const updatedChild = await tx.roomFFEItem.update({
        where: { id: itemId },
        data: {
          customFields: Object.keys(updatedChildCustomFields).length > 0
            ? updatedChildCustomFields
            : {},
          updatedById: userId
        }
      })

      // Update parent's linkedItems array if parent exists
      let updatedParent = null
      if (parentItem) {
        const parentCustomFields = (parentItem.customFields as any) || {}
        const currentLinkedItems = Array.isArray(parentCustomFields.linkedItems)
          ? parentCustomFields.linkedItems
          : []

        // Remove child name from parent's linkedItems array
        const updatedLinkedItems = currentLinkedItems.filter(
          (name: string) => name !== childItem.name
        )

        const hasChildren = updatedLinkedItems.length > 0

        updatedParent = await tx.roomFFEItem.update({
          where: { id: parentItem.id },
          data: {
            customFields: {
              ...parentCustomFields,
              hasChildren: hasChildren,
              linkedItems: updatedLinkedItems
            },
            updatedById: userId
          }
        })
      }

      return { updatedChild, updatedParent }
    })

    // Log the change
    await prisma.fFEChangeLog.create({
      data: {
        entityType: 'item',
        entityId: itemId,
        action: 'item_ungrouped',
        fieldName: 'customFields',
        oldValue: JSON.stringify({
          isGroupedItem: customFields.isGroupedItem,
          parentId: customFields.parentId,
          parentName: customFields.parentName
        }),
        newValue: JSON.stringify({ ungrouped: true }),
        userId: userId,
        orgId: childItem.section.instance.room.project.orgId,
        roomId: roomId,
        instanceId: childItem.section.instanceId,
        metadata: {
          childName: childItem.name,
          parentId: parentId,
          parentName: parentName
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Item ungrouped successfully',
      data: {
        item: {
          id: result.updatedChild.id,
          name: result.updatedChild.name,
          isGroupedItem: false
        },
        parent: result.updatedParent ? {
          id: result.updatedParent.id,
          name: result.updatedParent.name,
          hasChildren: ((result.updatedParent.customFields as any)?.linkedItems || []).length > 0
        } : null
      }
    })

  } catch (error) {
    console.error('Error ungrouping item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
