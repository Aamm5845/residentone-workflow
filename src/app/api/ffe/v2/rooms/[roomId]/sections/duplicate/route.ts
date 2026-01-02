import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Duplicate a section with all its items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id
    let orgId = session.user.orgId

    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userId = user.id
      orgId = user.orgId
    }

    const { roomId } = await params
    const { sectionId } = await request.json()

    if (!roomId || !sectionId) {
      return NextResponse.json({
        error: 'Room ID and section ID are required'
      }, { status: 400 })
    }

    // Verify section belongs to room and user's organization
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId
            }
          }
        }
      },
      include: {
        items: {
          orderBy: { order: 'asc' }
        },
        instance: {
          include: {
            sections: {
              orderBy: { order: 'desc' },
              take: 1
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Calculate next section order
    const maxOrder = section.instance.sections[0]?.order || 0
    const nextOrder = maxOrder + 1

    // Create duplicated section with items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the new section
      const newSection = await tx.roomFFESection.create({
        data: {
          instanceId: section.instanceId,
          name: `${section.name} (Copy)`,
          description: section.description,
          order: nextOrder,
          isExpanded: true,
          isCompleted: false,
          presetId: section.presetId,
          docCodePrefix: section.docCodePrefix
        }
      })

      // Duplicate all items
      const duplicatedItems = []
      for (const item of section.items) {
        const newItem = await tx.roomFFEItem.create({
          data: {
            sectionId: newSection.id,
            name: item.name,
            description: item.description,
            state: 'PENDING', // Reset state for new items
            visibility: item.visibility,
            specStatus: 'DRAFT', // Reset spec status
            isRequired: item.isRequired,
            isCustom: true,
            order: item.order,
            quantity: item.quantity,
            brand: item.brand,
            sku: item.sku,
            docCode: null, // Don't duplicate doc code to avoid conflicts
            material: item.material,
            color: item.color,
            finish: item.finish,
            width: item.width,
            height: item.height,
            depth: item.depth,
            leadTime: item.leadTime,
            supplierName: item.supplierName,
            supplierLink: item.supplierLink,
            unitCost: item.unitCost,
            tradePrice: item.tradePrice,
            rrp: item.rrp,
            tradeDiscount: item.tradeDiscount,
            currency: item.currency,
            unitType: item.unitType,
            images: item.images as any,
            notes: null, // Don't copy notes
            createdById: userId,
            updatedById: userId
          }
        })
        duplicatedItems.push(newItem)
      }

      return {
        section: newSection,
        items: duplicatedItems
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        section: result.section,
        itemCount: result.items.length
      },
      message: `Section "${section.name}" duplicated with ${result.items.length} items`
    })

  } catch (error) {
    console.error('Error duplicating section:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate section' },
      { status: 500 }
    )
  }
}
