import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/ffe-diagnose?roomId=xxx
 * Diagnoses FFE data for a room - finds duplicate sections from re-imported templates
 *
 * POST /api/admin/ffe-diagnose?roomId=xxx&action=cleanup
 * Removes duplicate template sections, keeping the ones with user modifications
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const projectName = searchParams.get('project')

    // If no roomId, list all rooms with FFE instances for the given project
    if (!roomId) {
      const rooms = await prisma.roomFFEInstance.findMany({
        where: {
          room: {
            project: {
              orgId: session.user.orgId,
              ...(projectName ? { name: { contains: projectName, mode: 'insensitive' as const } } : {})
            }
          }
        },
        include: {
          room: {
            select: {
              id: true,
              name: true,
              type: true,
              project: { select: { name: true } }
            }
          },
          sections: {
            include: {
              _count: { select: { items: true } }
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Add ?roomId=xxx to diagnose a specific room',
        rooms: rooms.map(r => ({
          roomId: r.roomId,
          roomName: r.room.name || r.room.type,
          projectName: r.room.project.name,
          templateId: r.templateId,
          sectionCount: r.sections.length,
          totalItems: r.sections.reduce((sum, s) => sum + s._count.items, 0),
          createdAt: r.createdAt
        }))
      })
    }

    // Diagnose specific room
    const instance = await prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        template: { select: { id: true, name: true } },
        room: {
          select: {
            name: true,
            type: true,
            project: { select: { name: true } }
          }
        },
        sections: {
          include: {
            items: {
              select: {
                id: true,
                name: true,
                isCustom: true,
                visibility: true,
                state: true,
                specStatus: true,
                createdAt: true,
                updatedAt: true,
                templateItemId: true,
                notes: true,
                supplierName: true,
                unitCost: true,
                _count: {
                  select: {
                    linkedSpecs: true,
                    ffeLinks: true
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!instance) {
      return NextResponse.json({ error: 'No FFE instance found for this room' }, { status: 404 })
    }

    // Group sections by templateSectionId to find duplicates
    const sectionsByTemplate: Record<string, typeof instance.sections> = {}
    const orphanSections: typeof instance.sections = []

    for (const section of instance.sections) {
      if (section.templateSectionId) {
        if (!sectionsByTemplate[section.templateSectionId]) {
          sectionsByTemplate[section.templateSectionId] = []
        }
        sectionsByTemplate[section.templateSectionId].push(section)
      } else {
        orphanSections.push(section)
      }
    }

    // Analyze each section group to identify which has user work
    const analysis = Object.entries(sectionsByTemplate).map(([templateSectionId, sections]) => {
      const isDuplicated = sections.length > 1

      const sectionDetails = sections.map(section => {
        const customItems = section.items.filter(i => i.isCustom)
        const visibleItems = section.items.filter(i => i.visibility === 'VISIBLE')
        const modifiedItems = section.items.filter(i =>
          i.createdAt.getTime() !== i.updatedAt.getTime()
        )
        const itemsWithSpecs = section.items.filter(i =>
          i._count.linkedSpecs > 0 || i._count.ffeLinks > 0
        )
        const itemsWithNotes = section.items.filter(i => i.notes)
        const itemsWithSupplier = section.items.filter(i => i.supplierName)
        const itemsWithCost = section.items.filter(i => i.unitCost)

        const userWorkScore =
          customItems.length * 10 +
          visibleItems.length * 5 +
          modifiedItems.length * 3 +
          itemsWithSpecs.length * 8 +
          itemsWithNotes.length * 2 +
          itemsWithSupplier.length * 4 +
          itemsWithCost.length * 4

        return {
          sectionId: section.id,
          name: section.name,
          totalItems: section.items.length,
          customItems: customItems.length,
          visibleItems: visibleItems.length,
          modifiedItems: modifiedItems.length,
          itemsWithSpecs: itemsWithSpecs.length,
          itemsWithNotes: itemsWithNotes.length,
          itemsWithSupplier: itemsWithSupplier.length,
          itemsWithCost: itemsWithCost.length,
          createdAt: section.createdAt,
          userWorkScore,
          recommendation: userWorkScore > 0 ? 'KEEP' : 'DUPLICATE_CANDIDATE'
        }
      })

      return {
        templateSectionId,
        sectionName: sections[0].name,
        isDuplicated,
        copies: sections.length,
        sections: sectionDetails
      }
    })

    // Also analyze orphan sections (no templateSectionId - likely user-created)
    const orphanAnalysis = orphanSections.map(section => ({
      sectionId: section.id,
      name: section.name,
      totalItems: section.items.length,
      customItems: section.items.filter(i => i.isCustom).length,
      visibleItems: section.items.filter(i => i.visibility === 'VISIBLE').length,
      createdAt: section.createdAt,
      recommendation: 'KEEP (user-created section)'
    }))

    const duplicatedGroups = analysis.filter(a => a.isDuplicated)
    const sectionsToRemove = duplicatedGroups.flatMap(g =>
      g.sections
        .sort((a, b) => b.userWorkScore - a.userWorkScore)
        .slice(1) // Keep the one with highest score, mark rest for removal
        .filter(s => s.userWorkScore === 0)
    )

    return NextResponse.json({
      success: true,
      room: {
        id: roomId,
        name: instance.room.name || instance.room.type,
        project: instance.room.project.name,
        template: instance.template?.name || 'No template'
      },
      summary: {
        totalSections: instance.sections.length,
        duplicatedGroups: duplicatedGroups.length,
        sectionsWithUserWork: analysis.flatMap(a => a.sections).filter(s => s.userWorkScore > 0).length,
        emptySections: analysis.flatMap(a => a.sections).filter(s => s.userWorkScore === 0).length,
        safeSectionsToRemove: sectionsToRemove.length,
        orphanSections: orphanSections.length
      },
      duplicatedGroups,
      orphanSections: orphanAnalysis,
      cleanupPreview: {
        sectionsToRemove: sectionsToRemove.map(s => ({
          sectionId: s.sectionId,
          name: s.name,
          itemCount: s.totalItems,
          reason: 'Duplicate with zero user modifications'
        })),
        note: 'Use POST with ?action=cleanup to remove these duplicate sections'
      }
    })

  } catch (error) {
    console.error('FFE diagnose error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const action = searchParams.get('action')

    if (!roomId || action !== 'cleanup') {
      return NextResponse.json({ error: 'Requires ?roomId=xxx&action=cleanup' }, { status: 400 })
    }

    // Get the room's FFE data
    const instance = await prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        sections: {
          include: {
            items: {
              select: {
                id: true,
                isCustom: true,
                visibility: true,
                createdAt: true,
                updatedAt: true,
                notes: true,
                supplierName: true,
                unitCost: true,
                _count: {
                  select: {
                    linkedSpecs: true,
                    ffeLinks: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!instance) {
      return NextResponse.json({ error: 'No FFE instance found' }, { status: 404 })
    }

    // Group sections by templateSectionId
    const sectionsByTemplate: Record<string, typeof instance.sections> = {}
    for (const section of instance.sections) {
      if (section.templateSectionId) {
        if (!sectionsByTemplate[section.templateSectionId]) {
          sectionsByTemplate[section.templateSectionId] = []
        }
        sectionsByTemplate[section.templateSectionId].push(section)
      }
    }

    // Find duplicate sections to remove (keep the one with most user work)
    const sectionsToDelete: string[] = []
    const kept: string[] = []

    for (const [, sections] of Object.entries(sectionsByTemplate)) {
      if (sections.length <= 1) continue

      // Score each section by user work
      const scored = sections.map(section => {
        const score = section.items.reduce((total, item) => {
          let s = 0
          if (item.isCustom) s += 10
          if (item.visibility === 'VISIBLE') s += 5
          if (item.createdAt.getTime() !== item.updatedAt.getTime()) s += 3
          if (item._count.linkedSpecs > 0 || item._count.ffeLinks > 0) s += 8
          if (item.notes) s += 2
          if (item.supplierName) s += 4
          if (item.unitCost) s += 4
          return total + s
        }, 0)
        return { section, score }
      })

      // Sort by score descending - keep the best one
      scored.sort((a, b) => b.score - a.score)
      kept.push(scored[0].section.id)

      // Only delete sections with zero user work
      for (let i = 1; i < scored.length; i++) {
        if (scored[i].score === 0) {
          sectionsToDelete.push(scored[i].section.id)
        }
      }
    }

    if (sectionsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No safe duplicate sections to remove. All sections contain user modifications.',
        analyzed: instance.sections.length
      })
    }

    // Delete duplicate sections (cascade deletes their items)
    const deleted = await prisma.roomFFESection.deleteMany({
      where: {
        id: { in: sectionsToDelete }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Removed ${deleted.count} duplicate sections`,
      removed: deleted.count,
      keptSections: kept,
      removedSectionIds: sectionsToDelete
    })

  } catch (error) {
    console.error('FFE cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
