import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/archive
 * Archive an item - sets status to ARCHIVED and removes all FFE workspace links
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

    // Find the item to archive
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
        },
        specLinks: true
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Perform transaction: update item status and remove all FFE links
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all spec links (FFESpecLink entries pointing to this item)
      await tx.fFESpecLink.deleteMany({
        where: { specItemId: itemId }
      })

      // 2. Clear the legacy ffeRequirementId link if this is a spec item
      // If the item has specs linked to it (it's a requirement), we need to update those specs
      if (item.isSpecItem === false) {
        // This is an FFE requirement - update linked spec items to clear the link
        await tx.roomFFEItem.updateMany({
          where: { ffeRequirementId: itemId },
          data: {
            ffeRequirementId: null,
            updatedById: userId
          }
        })
      }

      // 3. Update the item to ARCHIVED status and clear its own ffeRequirementId
      const updatedItem = await tx.roomFFEItem.update({
        where: { id: itemId },
        data: {
          specStatus: 'ARCHIVED',
          ffeRequirementId: null,
          updatedById: userId
        }
      })

      return updatedItem
    })

    // Log the archive action
    await prisma.fFEChangeLog.create({
      data: {
        entityType: 'item',
        entityId: itemId,
        action: 'item_archived',
        fieldName: 'specStatus',
        oldValue: item.specStatus || 'DRAFT',
        newValue: 'ARCHIVED',
        userId: userId,
        orgId: item.section.instance.room.project.orgId,
        roomId: roomId,
        instanceId: item.section.instanceId,
        metadata: {
          itemName: item.name,
          previousStatus: item.specStatus,
          linksRemoved: item.specLinks?.length || 0
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Item archived successfully',
      data: {
        id: result.id,
        name: result.name,
        specStatus: result.specStatus
      }
    })

  } catch (error) {
    console.error('Error archiving item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
