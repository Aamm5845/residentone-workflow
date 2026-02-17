import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/linked-items
 * Add or remove linked items (children) for a parent item
 * 
 * This endpoint operates only on roomFFEItem rows (room instance level)
 * and does NOT modify templates.
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
    const body = await request.json()
    const { action, name, childItemId } = body

    // Validate action
    if (!action || !['add', 'remove', 'link-existing'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "add", "remove", or "link-existing"' },
        { status: 400 }
      )
    }

    // Find the parent item
    const parentItem = await prisma.roomFFEItem.findFirst({
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

    if (!parentItem) {
      return NextResponse.json({ error: 'Parent item not found' }, { status: 404 })
    }

    // Handle ADD action
    if (action === 'add') {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Child item name is required and must be non-empty' },
          { status: 400 }
        )
      }

      const trimmedName = name.trim()
      
      // Validate name length
      if (trimmedName.length > 200) {
        return NextResponse.json(
          { error: 'Child item name must be 200 characters or less' },
          { status: 400 }
        )
      }

      // Check for duplicate child names under the same parent
      const existingChildren = await prisma.roomFFEItem.findMany({
        where: {
          sectionId: parentItem.sectionId,
          customFields: {
            path: ['isGroupedItem'],
            equals: true
          },
          AND: {
            customFields: {
              path: ['parentId'],
              equals: itemId
            }
          }
        }
      })

      const childExists = existingChildren.some(
        child => child.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (childExists) {
        return NextResponse.json(
          { error: `A grouped item named "${trimmedName}" already exists under this parent` },
          { status: 400 }
        )
      }

      // Get current linkedItems array from parent
      const currentCustomFields = (parentItem.customFields as any) || {}
      const currentLinkedItems = Array.isArray(currentCustomFields.linkedItems) 
        ? currentCustomFields.linkedItems 
        : []

      // Calculate order for the new child
      const maxOrder = existingChildren.length > 0
        ? Math.max(...existingChildren.map(c => c.order))
        : parentItem.order

      // Perform transaction: create child + update parent
      const result = await prisma.$transaction(async (tx) => {
        // Create the child item (grouped item)
        const childItem = await tx.roomFFEItem.create({
          data: {
            sectionId: parentItem.sectionId,
            name: trimmedName,
            description: null,
            state: 'PENDING',
            visibility: parentItem.visibility, // Match parent's visibility
            isRequired: false,
            isCustom: true,
            order: maxOrder + 0.1,
            quantity: 1,
            customFields: {
              isGroupedItem: true,
              parentId: itemId, // Use parent ID instead of name for stable relationship
              // Keep legacy fields for backwards compatibility
              isLinkedItem: true,
              parentName: parentItem.name
            },
            createdById: userId,
            updatedById: userId
          }
        })

        // Update parent's customFields
        const updatedLinkedItems = [...currentLinkedItems, trimmedName]
        const updatedParent = await tx.roomFFEItem.update({
          where: { id: itemId },
          data: {
            customFields: {
              ...currentCustomFields,
              hasChildren: true,
              linkedItems: updatedLinkedItems
            },
            updatedById: userId
          }
        })

        return { childItem, updatedParent }
      })

      // Log the change
      await prisma.fFEChangeLog.create({
        data: {
          entityType: 'item',
          entityId: itemId,
          action: 'linked_item_added',
          fieldName: 'linkedItems',
          oldValue: JSON.stringify(currentLinkedItems),
          newValue: JSON.stringify([...currentLinkedItems, trimmedName]),
          userId: userId,
          orgId: parentItem.section.instance.room.project.orgId,
          roomId: roomId,
          instanceId: parentItem.section.instanceId,
          metadata: {
            parentName: parentItem.name,
            childName: trimmedName,
            childId: result.childItem.id
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Grouped item added successfully',
        data: {
          parent: {
            id: result.updatedParent.id,
            name: result.updatedParent.name,
            hasChildren: true,
            linkedItems: [...currentLinkedItems, trimmedName]
          },
          child: {
            id: result.childItem.id,
            name: result.childItem.name,
            isGroupedItem: true,
            parentId: itemId
          }
        }
      })
    }

    // Handle LINK-EXISTING action — mark an existing item as a grouped child without creating a new item
    if (action === 'link-existing') {
      if (!childItemId) {
        return NextResponse.json(
          { error: 'childItemId is required for link-existing action' },
          { status: 400 }
        )
      }

      // Find the target item across all sections in this room
      const targetItem = await prisma.roomFFEItem.findFirst({
        where: {
          id: childItemId,
          section: {
            instance: {
              roomId: roomId
            }
          }
        }
      })

      if (!targetItem) {
        return NextResponse.json(
          { error: 'Target item not found in this room' },
          { status: 404 }
        )
      }

      // Check if target is already a grouped child
      const targetCustomFields = (targetItem.customFields as any) || {}
      if (targetCustomFields.isGroupedItem || targetCustomFields.isLinkedItem) {
        return NextResponse.json(
          { error: 'This item is already grouped under another item' },
          { status: 400 }
        )
      }

      // Check if target is the parent itself
      if (targetItem.id === itemId) {
        return NextResponse.json(
          { error: 'Cannot group an item under itself' },
          { status: 400 }
        )
      }

      // Get current linkedItems array from parent
      const currentCustomFields = (parentItem.customFields as any) || {}
      const currentLinkedItems = Array.isArray(currentCustomFields.linkedItems)
        ? currentCustomFields.linkedItems
        : []

      // Perform transaction: update child customFields + update parent
      const result = await prisma.$transaction(async (tx) => {
        // Update the target item to mark it as a grouped child
        const updatedChild = await tx.roomFFEItem.update({
          where: { id: childItemId },
          data: {
            customFields: {
              ...targetCustomFields,
              isGroupedItem: true,
              isLinkedItem: true,
              parentId: itemId,
              parentName: parentItem.name
            },
            updatedById: userId
          }
        })

        // Update parent's customFields
        const updatedLinkedItems = [...currentLinkedItems, targetItem.name]
        const updatedParent = await tx.roomFFEItem.update({
          where: { id: itemId },
          data: {
            customFields: {
              ...currentCustomFields,
              hasChildren: true,
              linkedItems: updatedLinkedItems
            },
            updatedById: userId
          }
        })

        return { updatedChild, updatedParent, updatedLinkedItems }
      })

      // Log the change
      await prisma.fFEChangeLog.create({
        data: {
          entityType: 'item',
          entityId: itemId,
          action: 'existing_item_linked',
          fieldName: 'linkedItems',
          oldValue: JSON.stringify(currentLinkedItems),
          newValue: JSON.stringify(result.updatedLinkedItems),
          userId: userId,
          orgId: parentItem.section.instance.room.project.orgId,
          roomId: roomId,
          instanceId: parentItem.section.instanceId,
          metadata: {
            parentName: parentItem.name,
            childName: targetItem.name,
            childId: childItemId
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Existing item linked as grouped child',
        data: {
          parent: {
            id: result.updatedParent.id,
            name: result.updatedParent.name,
            hasChildren: true,
            linkedItems: result.updatedLinkedItems
          },
          child: {
            id: result.updatedChild.id,
            name: result.updatedChild.name,
            isGroupedItem: true,
            parentId: itemId
          }
        }
      })
    }

    // Handle REMOVE action
    if (action === 'remove') {
      if (!childItemId) {
        return NextResponse.json(
          { error: 'childItemId is required for remove action' },
          { status: 400 }
        )
      }

      // Find the child item across ALL sections in this room (supports cross-section grouping)
      const childItem = await prisma.roomFFEItem.findFirst({
        where: {
          id: childItemId,
          section: {
            instance: {
              roomId: roomId
            }
          },
          OR: [
            {
              customFields: {
                path: ['parentId'],
                equals: itemId
              }
            },
            {
              customFields: {
                path: ['parentName'],
                equals: parentItem.name
              }
            }
          ]
        }
      })

      if (!childItem) {
        return NextResponse.json(
          { error: 'Grouped item not found or does not belong to this parent' },
          { status: 404 }
        )
      }

      // Get current linkedItems array
      const currentCustomFields = (parentItem.customFields as any) || {}
      const currentLinkedItems = Array.isArray(currentCustomFields.linkedItems)
        ? currentCustomFields.linkedItems
        : []

      // Remove child name from array
      const updatedLinkedItems = currentLinkedItems.filter(
        (itemName: string) => itemName !== childItem.name
      )

      // Instead of deleting the child, just remove the grouping flags so it becomes standalone
      const childCustomFields = (childItem.customFields as any) || {}
      const result = await prisma.$transaction(async (tx) => {
        // Unmark the child item — remove grouping flags, keep everything else
        await tx.roomFFEItem.update({
          where: { id: childItemId },
          data: {
            customFields: {
              ...childCustomFields,
              isGroupedItem: false,
              isLinkedItem: false,
              parentId: null,
              parentName: null
            },
            updatedById: userId
          }
        })

        // Update parent's customFields
        const hasChildren = updatedLinkedItems.length > 0
        const updatedParent = await tx.roomFFEItem.update({
          where: { id: itemId },
          data: {
            customFields: {
              ...currentCustomFields,
              hasChildren: hasChildren,
              linkedItems: updatedLinkedItems
            },
            updatedById: userId
          }
        })

        return { updatedParent }
      })

      // Log the change
      await prisma.fFEChangeLog.create({
        data: {
          entityType: 'item',
          entityId: itemId,
          action: 'linked_item_removed',
          fieldName: 'linkedItems',
          oldValue: JSON.stringify(currentLinkedItems),
          newValue: JSON.stringify(updatedLinkedItems),
          userId: userId,
          orgId: parentItem.section.instance.room.project.orgId,
          roomId: roomId,
          instanceId: parentItem.section.instanceId,
          metadata: {
            parentName: parentItem.name,
            childName: childItem.name,
            childId: childItemId
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Grouped item removed successfully',
        data: {
          parent: {
            id: result.updatedParent.id,
            name: result.updatedParent.name,
            hasChildren: updatedLinkedItems.length > 0,
            linkedItems: updatedLinkedItems
          },
          removedChildId: childItemId
        }
      })
    }

  } catch (error) {
    console.error('Error managing grouped items:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
