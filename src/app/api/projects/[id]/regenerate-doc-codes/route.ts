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
 * - Get all FFE requirement items in that category across all rooms
 * - Group FFE items that share the same spec item (they must have the same doc code)
 * - Assign sequential doc codes per group: PREFIX-01, PREFIX-02, etc.
 * - Update both the FFE requirement items AND any linked spec items
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
    const { categories, preview } = body as { categories?: string[]; preview?: boolean }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms with sections and FFE requirement items
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
                  orderBy: { order: 'asc' }
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
          category.items.push({
            id: item.id,
            name: item.name,
            currentDocCode: item.docCode,
            roomName,
            order: item.order,
            roomOrder: roomName
          })
        })
      })
    })

    // Collect all FFE item IDs
    const allFfeItemIds: string[] = []
    for (const category of categoryMap.values()) {
      for (const item of category.items) {
        allFfeItemIds.push(item.id)
      }
    }

    // Fetch spec links separately for reliability (both modern and legacy)
    const [specLinks, legacySpecItems] = await Promise.all([
      allFfeItemIds.length > 0
        ? prisma.fFESpecLink.findMany({
            where: { ffeRequirementId: { in: allFfeItemIds } },
            select: { specItemId: true, ffeRequirementId: true }
          })
        : Promise.resolve([]),
      allFfeItemIds.length > 0
        ? prisma.roomFFEItem.findMany({
            where: { ffeRequirementId: { in: allFfeItemIds }, isSpecItem: true },
            select: { id: true, ffeRequirementId: true }
          })
        : Promise.resolve([])
    ])

    // Build bidirectional maps: ffeToSpecs and specToFfes
    const ffeToSpecs = new Map<string, Set<string>>()
    const specToFfes = new Map<string, Set<string>>()

    const addLink = (ffeId: string, specId: string) => {
      if (!ffeToSpecs.has(ffeId)) ffeToSpecs.set(ffeId, new Set())
      ffeToSpecs.get(ffeId)!.add(specId)
      if (!specToFfes.has(specId)) specToFfes.set(specId, new Set())
      specToFfes.get(specId)!.add(ffeId)
    }

    // Modern FFESpecLink links
    for (const link of specLinks) {
      addLink(link.ffeRequirementId, link.specItemId)
    }

    // Legacy ffeRequirementId-based links
    for (const spec of legacySpecItems) {
      if (spec.ffeRequirementId) {
        addLink(spec.ffeRequirementId, spec.id)
      }
    }

    // Now regenerate doc codes for each category using grouped assignment
    const updates: Array<{ itemId: string; oldDocCode: string | null; newDocCode: string }> = []
    const specUpdates: Array<{ itemId: string; newDocCode: string }> = []
    const mergedGroups: Array<{
      newDocCode: string
      category: string
      items: Array<{ name: string; roomName: string }>
    }> = []

    for (const [categoryName, category] of categoryMap.entries()) {
      if (!category.docCodePrefix) continue

      const prefix = category.docCodePrefix

      // Sort items: by room name first, then by order within room
      category.items.sort((a, b) => {
        const roomCompare = a.roomOrder.localeCompare(b.roomOrder)
        if (roomCompare !== 0) return roomCompare
        return a.order - b.order
      })

      // Build a set of all FFE item IDs in this category for fast lookup
      const categoryItemIds = new Set(category.items.map(i => i.id))

      // Find connected components (groups) using BFS
      // FFE items sharing the same spec item must get the same doc code
      const visited = new Set<string>()
      const groups: Array<{
        ffeItemIds: Set<string>
        specItemIds: Set<string>
      }> = []

      for (const item of category.items) {
        if (visited.has(item.id)) continue

        const group = { ffeItemIds: new Set<string>(), specItemIds: new Set<string>() }
        const queue = [item.id]

        while (queue.length > 0) {
          const ffeId = queue.shift()!
          if (visited.has(ffeId)) continue
          visited.add(ffeId)
          group.ffeItemIds.add(ffeId)

          // Find all spec items linked to this FFE item
          const linkedSpecs = ffeToSpecs.get(ffeId)
          if (linkedSpecs) {
            for (const specId of linkedSpecs) {
              group.specItemIds.add(specId)
              // Find all other FFE items linked to this spec item (within this category)
              const linkedFfes = specToFfes.get(specId)
              if (linkedFfes) {
                for (const otherFfeId of linkedFfes) {
                  if (!visited.has(otherFfeId) && categoryItemIds.has(otherFfeId)) {
                    queue.push(otherFfeId)
                  }
                }
              }
            }
          }
        }

        groups.push(group)
      }

      // For each group, collect actual items sorted by room name then order
      const sortedGroups = groups.map(group => {
        const items = category.items.filter(i => group.ffeItemIds.has(i.id))
        return { items, specItemIds: group.specItemIds }
      })

      // Assign one sequential doc code per group
      let counter = 1
      for (const group of sortedGroups) {
        const newDocCode = `${prefix}-${String(counter).padStart(2, '0')}`
        counter++

        // All FFE items in this group get the same doc code
        for (const item of group.items) {
          updates.push({
            itemId: item.id,
            oldDocCode: item.currentDocCode,
            newDocCode
          })
        }

        // All linked spec items get the same doc code
        for (const specId of group.specItemIds) {
          specUpdates.push({
            itemId: specId,
            newDocCode
          })
        }

        // Track merged groups (groups with 2+ FFE items sharing a doc code)
        if (group.items.length > 1) {
          mergedGroups.push({
            newDocCode,
            category: categoryName,
            items: group.items.map(i => ({ name: i.name, roomName: i.roomName }))
          })
        }
      }
    }

    // Deduplicate spec updates (a spec could appear in multiple categories; keep first)
    const seenSpecIds = new Set<string>()
    const dedupedSpecUpdates = specUpdates.filter(u => {
      if (seenSpecIds.has(u.itemId)) return false
      seenSpecIds.add(u.itemId)
      return true
    })

    // If preview mode, return info without making changes
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        totalItems: updates.length,
        specItemsToUpdate: dedupedSpecUpdates.length,
        mergedGroups,
        categoriesProcessed: Array.from(categoryMap.entries())
          .filter(([_, cat]) => cat.docCodePrefix)
          .map(([name, cat]) => ({
            name,
            prefix: cat.docCodePrefix,
            itemCount: cat.items.length
          })),
        debug: {
          totalFfeItemIds: allFfeItemIds.length,
          specLinksFound: specLinks.length,
          legacySpecItemsFound: legacySpecItems.length,
          ffeToSpecsMapSize: ffeToSpecs.size,
          specToFfesMapSize: specToFfes.size,
          categoriesWithPrefix: Array.from(categoryMap.entries())
            .filter(([_, cat]) => cat.docCodePrefix)
            .map(([name]) => name),
          categoriesWithoutPrefix: Array.from(categoryMap.entries())
            .filter(([_, cat]) => !cat.docCodePrefix)
            .map(([name, cat]) => ({ name, itemCount: cat.items.length }))
        }
      })
    }

    // Execute all updates in a transaction
    if (updates.length > 0 || dedupedSpecUpdates.length > 0) {
      await prisma.$transaction([
        ...updates.map(u =>
          prisma.roomFFEItem.update({
            where: { id: u.itemId },
            data: { docCode: u.newDocCode }
          })
        ),
        ...dedupedSpecUpdates.map(u =>
          prisma.roomFFEItem.update({
            where: { id: u.itemId },
            data: { docCode: u.newDocCode }
          })
        )
      ])
    }

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      specUpdatedCount: dedupedSpecUpdates.length,
      mergedGroups,
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
