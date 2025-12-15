import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/ffe-items
 * Get all FFE Workspace items (requirements) for a project, grouped by room > section
 * Used for linking products in All Specs to FFE requirements
 */
export async function GET(
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

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms with their FFE instances, sections, and items
    // FFE Workspace items (requirements) have:
    // - isSpecItem: false (or null, defaults to false)
    // - specStatus: DRAFT, NEEDS_SPEC, or null (not SELECTED which is for All Specs)
    // - ffeRequirementId: null (they ARE the requirements, not linked to one)
    const rooms = await prisma.room.findMany({
      where: { projectId },
      include: {
        ffeInstance: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  // Get all requirement items (not spec items) - including linked/child items
                  // Requirements are items that: 
                  // 1. isSpecItem is false (they are requirements, not specs)
                  // 2. ffeRequirementId is null (they are NOT linked to another item as a spec)
                  where: { 
                    isSpecItem: false,
                    ffeRequirementId: null, // Requirements don't have a parent requirement
                    visibility: 'VISIBLE'
                  },
                  orderBy: { order: 'asc' },
                  include: {
                    // Include linked specs to show "chosen" status
                    linkedSpecs: {
                      select: {
                        id: true,
                        name: true,
                        brand: true,
                        sku: true,
                        isOption: true,
                        optionNumber: true
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

    // Transform into a structured format for the dropdown
    const ffeItems = rooms
      .filter(room => room.ffeInstance && room.ffeInstance.sections.length > 0)
      .map(room => ({
        roomId: room.id,
        roomName: room.name || room.type.replace(/_/g, ' '),
        sections: room.ffeInstance!.sections
          .filter(section => section.items.length > 0)
          .map(section => {
            // Get all items in this section
            const allItems = section.items
            
            // Separate parent items and linked/child items
            // Linked items have customFields.isLinkedItem = true and customFields.parentName
            const parentItems = allItems.filter(item => 
              !(item.customFields as any)?.isLinkedItem
            )
            const linkedItems = allItems.filter(item => 
              (item.customFields as any)?.isLinkedItem
            )
            
            return {
              sectionId: section.id,
              sectionName: section.name,
              items: allItems.map(item => {
                const customFields = item.customFields as any
                const isLinkedItem = customFields?.isLinkedItem === true
                const parentName = customFields?.parentName || null
                
                return {
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  quantity: item.quantity,
                  hasLinkedSpecs: item.linkedSpecs.length > 0,
                  linkedSpecsCount: item.linkedSpecs.length,
                  linkedSpecs: item.linkedSpecs,
                  // Linked item info (child of another item)
                  isLinkedItem,
                  parentName,
                  // For display: show if already chosen
                  status: item.linkedSpecs.length > 0 
                    ? (item.linkedSpecs.length === 1 ? 'chosen' : `${item.linkedSpecs.length} options`)
                    : 'needs_selection'
                }
              })
            }
          })
      }))

    // Also get flat list of all sections (for All Specs section headers)
    const allSections = new Map<string, { id: string; name: string; roomIds: string[] }>()
    
    rooms.forEach(room => {
      if (room.ffeInstance) {
        room.ffeInstance.sections.forEach(section => {
          const key = section.name.toLowerCase()
          if (allSections.has(key)) {
            allSections.get(key)!.roomIds.push(room.id)
          } else {
            allSections.set(key, {
              id: section.id,
              name: section.name,
              roomIds: [room.id]
            })
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      ffeItems,
      // Unique sections across all rooms (for All Specs section grouping)
      uniqueSections: Array.from(allSections.values()).map(s => ({
        name: s.name,
        roomCount: s.roomIds.length
      }))
    })

  } catch (error) {
    console.error('Error fetching project FFE items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch FFE items' },
      { status: 500 }
    )
  }
}
