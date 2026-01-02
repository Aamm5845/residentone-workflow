import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/unlink-spec
 * Unlink an FFE item from a spec item - the spec becomes "unlinked" and can be relinked to another FFE item
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

    // Parse request body
    const body = await request.json()
    const { specId } = body

    if (!specId) {
      return NextResponse.json({ error: 'specId is required' }, { status: 400 })
    }

    // Find the FFE requirement item
    const ffeItem = await prisma.roomFFEItem.findFirst({
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

    if (!ffeItem) {
      return NextResponse.json({ error: 'FFE item not found' }, { status: 404 })
    }

    // Find the spec item
    const specItem = await prisma.roomFFEItem.findUnique({
      where: { id: specId }
    })

    if (!specItem) {
      return NextResponse.json({ error: 'Spec item not found' }, { status: 404 })
    }

    // Perform transaction: remove the link between FFE item and spec item
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete the FFESpecLink if it exists (many-to-many link)
      await tx.fFESpecLink.deleteMany({
        where: {
          specItemId: specId,
          ffeRequirementId: itemId
        }
      })

      // 2. Clear the legacy ffeRequirementId on the spec item if it points to this FFE item
      if (specItem.ffeRequirementId === itemId) {
        await tx.roomFFEItem.update({
          where: { id: specId },
          data: {
            ffeRequirementId: null,
            updatedById: userId
          }
        })
      }

      // 3. Update the spec item status to indicate it's unlinked (set to DRAFT or a special status)
      const updatedSpec = await tx.roomFFEItem.update({
        where: { id: specId },
        data: {
          specStatus: 'DRAFT', // Reset to draft so it shows as needing to be linked
          updatedById: userId
        }
      })

      return updatedSpec
    })

    // Log the unlink action
    await prisma.fFEChangeLog.create({
      data: {
        entityType: 'item',
        entityId: itemId,
        action: 'spec_unlinked',
        fieldName: 'linkedSpec',
        oldValue: specId,
        newValue: null,
        userId: userId,
        orgId: ffeItem.section.instance.room.project.orgId,
        roomId: roomId,
        instanceId: ffeItem.section.instanceId,
        metadata: {
          ffeItemName: ffeItem.name,
          specItemId: specId,
          specItemName: specItem.name
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Spec unlinked successfully',
      data: {
        ffeItemId: itemId,
        specId: specId,
        specName: specItem.name
      }
    })

  } catch (error) {
    console.error('Error unlinking spec:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
