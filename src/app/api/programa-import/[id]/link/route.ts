import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/programa-import/[id]/link
 * Link a programa item to an FFE requirement by creating a new spec item
 * This matches the pattern used by the extension clip API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: programaItemId } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const body = await request.json()
    const { roomFFEItemId } = body

    if (!roomFFEItemId) {
      return NextResponse.json({ error: 'roomFFEItemId is required' }, { status: 400 })
    }

    // Verify programa item belongs to org
    const programaItem = await prisma.programaItem.findFirst({
      where: { id: programaItemId, orgId }
    })

    if (!programaItem) {
      return NextResponse.json({ error: 'Programa item not found' }, { status: 404 })
    }

    // Verify FFE requirement item exists and get its details
    const ffeRequirement = await prisma.roomFFEItem.findFirst({
      where: { id: roomFFEItemId },
      select: {
        id: true,
        name: true,
        sectionId: true,
        docCode: true, // Fetch docCode to copy to linked spec item
        section: {
          select: {
            instanceId: true,
            instance: {
              select: {
                room: {
                  select: {
                    project: { select: { orgId: true } }
                  }
                }
              }
            }
          }
        },
        // Check how many specs are already linked
        linkedSpecs: {
          select: { id: true }
        }
      }
    })

    if (!ffeRequirement || ffeRequirement.section.instance.room.project.orgId !== orgId) {
      return NextResponse.json({ error: 'FFE item not found' }, { status: 404 })
    }

    // Get next order in section
    const lastItem = await prisma.roomFFEItem.findFirst({
      where: { sectionId: ffeRequirement.sectionId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })
    const nextOrder = (lastItem?.order || 0) + 1

    // Check if this is an option (if requirement already has specs)
    const existingSpecsCount = ffeRequirement.linkedSpecs?.length || 0
    const isOption = existingSpecsCount > 0
    const optionNumber = isOption ? existingSpecsCount + 1 : null

    // Build images array
    const images = programaItem.imageUrl ? [programaItem.imageUrl] : []

    // Create a NEW spec item linked to the FFE requirement (same pattern as extension clip)
    const specItem = await prisma.roomFFEItem.create({
      data: {
        sectionId: ffeRequirement.sectionId,
        // Use programa product name
        name: programaItem.name,
        description: programaItem.description || null,
        state: 'PENDING',
        visibility: 'VISIBLE',
        // Mark as a spec item linked to the requirement
        isSpecItem: true,
        ffeRequirementId: ffeRequirement.id,
        isOption: isOption,
        optionNumber: optionNumber,
        specStatus: 'SELECTED',
        isRequired: false,
        isCustom: true,
        order: nextOrder,
        // Supplier
        supplierName: programaItem.supplierCompanyName || null,
        supplierLink: programaItem.websiteUrl || null,
        // Product details
        brand: programaItem.brand || null,
        sku: programaItem.sku || null,
        // Copy docCode from FFE requirement if it has one
        docCode: ffeRequirement.docCode || null,
        modelNumber: programaItem.sku || null,
        color: programaItem.color || null,
        finish: programaItem.finish || null,
        material: programaItem.material || null,
        leadTime: programaItem.leadTime || null,
        // Dimensions
        width: programaItem.width || null,
        height: programaItem.height || null,
        depth: programaItem.depth || null,
        length: programaItem.length || null,
        // Pricing
        quantity: programaItem.quantity || 1,
        rrp: programaItem.rrp || null,
        tradePrice: programaItem.tradePrice || null,
        // Images
        images: images,
        notes: programaItem.notes || null,
        // User tracking
        createdById: userId,
        updatedById: userId
      }
    })

    // Update programa item to link to the NEW spec item (not the requirement)
    const updatedProgramaItem = await prisma.programaItem.update({
      where: { id: programaItemId },
      data: {
        linkedRoomFFEItemId: specItem.id,
        linkedAt: new Date(),
        linkedById: userId
      }
    })

    // Update FFE instance progress
    const instanceId = ffeRequirement.section.instanceId
    const instance = await prisma.roomFFEInstance.findUnique({
      where: { id: instanceId },
      include: {
        sections: {
          include: {
            items: {
              where: { visibility: 'VISIBLE' }
            }
          }
        }
      }
    })

    if (instance) {
      const totalItems = instance.sections.reduce((sum, s) => sum + s.items.length, 0)
      const completedItems = instance.sections.reduce(
        (sum, s) => sum + s.items.filter(i => i.state === 'COMPLETED').length,
        0
      )
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

      await prisma.roomFFEInstance.update({
        where: { id: instanceId },
        data: { progress }
      })
    }

    return NextResponse.json({
      success: true,
      specItem: {
        id: specItem.id,
        name: specItem.name,
        ffeRequirementId: specItem.ffeRequirementId
      },
      programaItem: updatedProgramaItem,
      message: `Product linked to "${ffeRequirement.name}" successfully`
    })
  } catch (error) {
    console.error('Error linking programa item:', error)
    return NextResponse.json({ error: 'Failed to link item' }, { status: 500 })
  }
}

/**
 * DELETE /api/programa-import/[id]/link
 * Unlink a programa item from an FFE item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: programaItemId } = await params
    const orgId = (session.user as any).orgId

    // Verify programa item belongs to org
    const programaItem = await prisma.programaItem.findFirst({
      where: { id: programaItemId, orgId }
    })

    if (!programaItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Remove link
    const updated = await prisma.programaItem.update({
      where: { id: programaItemId },
      data: {
        linkedRoomFFEItemId: null,
        linkedAt: null,
        linkedById: null
      }
    })

    return NextResponse.json({
      success: true,
      item: updated
    })
  } catch (error) {
    console.error('Error unlinking programa item:', error)
    return NextResponse.json({ error: 'Failed to unlink item' }, { status: 500 })
  }
}
