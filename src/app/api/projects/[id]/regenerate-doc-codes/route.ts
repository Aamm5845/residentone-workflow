import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/regenerate-doc-codes
 * Regenerate doc codes for FFE items in a project
 *
 * Body: { categories?: string[] }
 * - If categories provided: regenerate only for those section names
 * - If empty/null: regenerate for ALL categories
 *
 * Logic:
 * - For each category (section name), find the docCodePrefix from the section
 * - Get all FFE requirement items in that category across all rooms, ordered by their position
 * - Assign sequential doc codes: PREFIX-01, PREFIX-02, etc.
 * - Update both the FFE requirement items AND any linked spec items that copied the doc code
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

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { categories } = body as { categories?: string[] }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms with sections and items for this project
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
                    isSpecItem: false,
                    ffeRequirementId: null,
                    visibility: 'VISIBLE'
                  },
                  orderBy: { order: 'asc' },
                  include: {
                    // Get linked spec items to update their doc codes too
                    linkedSpecs: {
                      select: { id: true, docCode: true }
                    },
                    ffeLinks: {
                      select: {
                        specItem: {
                          select: { id: true, docCode: true }
                        }
                      }
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

    // Group items by section name (category)
    const categoryMap = new Map<string, {
      docCodePrefix: string | null
      items: Array<{
        id: string
        name: string
        currentDocCode: string | null
        roomName: string
        order: number
        roomOrder: string
        linkedSpecIds: string[]
      }>
    }>()

    rooms.forEach(room => {
      if (!room.ffeInstance) return
      const roomName = room.name || room.type.replace(/_/g, ' ')

      room.ffeInstance.sections.forEach(section => {
        const categoryKey = section.name

        // Skip if categories filter provided and this category isn't in it
        if (categories && categories.length > 0 && !categories.includes(categoryKey)) return

        if (!categoryMap.has(categoryKey)) {
          categoryMap.set(categoryKey, {
            docCodePrefix: section.docCodePrefix || null,
            items: []
          })
        }

        const category = categoryMap.get(categoryKey)!
        // If we find a prefix on any section with this name, use it
        if (!category.docCodePrefix && section.docCodePrefix) {
          category.docCodePrefix = section.docCodePrefix
        }

        section.items.forEach(item => {
          // Collect all linked spec item IDs (both legacy and new linking)
          const linkedSpecIds: string[] = []
          if (item.linkedSpecs) {
            item.linkedSpecs.forEach(spec => linkedSpecIds.push(spec.id))
          }
          if (item.ffeLinks) {
            item.ffeLinks.forEach(link => {
              if (link.specItem) linkedSpecIds.push(link.specItem.id)
            })
          }

          category.items.push({
            id: item.id,
            name: item.name,
            currentDocCode: item.docCode,
            roomName,
            order: item.order,
            roomOrder: roomName, // for sorting by room then order
            linkedSpecIds: [...new Set(linkedSpecIds)] // deduplicate
          })
        })
      })
    })

    // Now regenerate doc codes for each category
    const updates: Array<{ itemId: string; oldDocCode: string | null; newDocCode: string }> = []
    const specUpdates: Array<{ itemId: string; newDocCode: string }> = []

    for (const [categoryName, category] of categoryMap.entries()) {
      if (!category.docCodePrefix) {
        // Skip categories without a prefix - can't generate doc codes
        continue
      }

      const prefix = category.docCodePrefix

      // Sort items: by room name first, then by order within room
      category.items.sort((a, b) => {
        const roomCompare = a.roomOrder.localeCompare(b.roomOrder)
        if (roomCompare !== 0) return roomCompare
        return a.order - b.order
      })

      // Assign sequential doc codes
      category.items.forEach((item, index) => {
        const newDocCode = `${prefix}-${String(index + 1).padStart(2, '0')}`

        updates.push({
          itemId: item.id,
          oldDocCode: item.currentDocCode,
          newDocCode
        })

        // Also update linked spec items
        item.linkedSpecIds.forEach(specId => {
          specUpdates.push({
            itemId: specId,
            newDocCode
          })
        })
      })
    }

    // Execute all updates in a transaction
    await prisma.$transaction(
      [
        ...updates.map(u =>
          prisma.roomFFEItem.update({
            where: { id: u.itemId },
            data: { docCode: u.newDocCode }
          })
        ),
        ...specUpdates.map(u =>
          prisma.roomFFEItem.update({
            where: { id: u.itemId },
            data: { docCode: u.newDocCode }
          })
        )
      ]
    )

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      specUpdatedCount: specUpdates.length,
      updates: updates.map(u => ({
        itemId: u.itemId,
        oldDocCode: u.oldDocCode,
        newDocCode: u.newDocCode
      })),
      categoriesProcessed: Array.from(categoryMap.entries())
        .filter(([_, cat]) => cat.docCodePrefix)
        .map(([name, cat]) => ({
          name,
          prefix: cat.docCodePrefix,
          itemCount: cat.items.length
        }))
    })

  } catch (error) {
    console.error('Error regenerating doc codes:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate doc codes' },
      { status: 500 }
    )
  }
}
