import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/extension-auth'

// GET: Get items that need specs for a room (for linking in extension)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    
    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }
    
    // Verify room belongs to user's organization
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: user.orgId
        }
      },
      include: {
        ffeInstance: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  where: {
                    visibility: 'VISIBLE',
                    // Only get requirement items, not spec items
                    // Requirements have isSpecItem: false AND ffeRequirementId: null
                    // (they ARE the requirements, not linked to one)
                    isSpecItem: false,
                    ffeRequirementId: null
                  },
                  include: {
                    // Include linked specs to check if item has products linked
                    linkedSpecs: {
                      select: { id: true }
                    }
                  },
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    })
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    if (!room.ffeInstance) {
      return NextResponse.json({ 
        ok: true,
        items: [],
        message: 'No FFE instance for this room yet'
      })
    }
    
    // Get all requirement items, marking which ones need specs
    const items: Array<{
      id: string
      name: string
      sectionId: string
      sectionName: string
      hasSpec: boolean
      needsSpec: boolean
    }> = []
    
    room.ffeInstance.sections.forEach(section => {
      section.items.forEach(item => {
        // An item has a spec if:
        // 1. It has linkedSpecs (new-style: product items linked to it)
        // 2. OR it has direct spec fields set (old-style: fields updated directly on the requirement)
        const linkedSpecs = (item as any).linkedSpecs || []
        const hasLinkedSpecs = linkedSpecs.length > 0
        
        // Fallback: check if direct fields are set (for backwards compatibility with old clips)
        const hasDirectFields = !!(
          (item as any).brand ||
          (item as any).sku ||
          (item as any).supplierName ||
          (item as any).supplierLink ||
          ((item as any).images && (item as any).images.length > 0) ||
          (item as any).specStatus === 'SELECTED'
        )
        
        const hasSpec = hasLinkedSpecs || hasDirectFields
        
        items.push({
          id: item.id,
          name: item.name,
          sectionId: section.id,
          sectionName: section.name,
          hasSpec,
          needsSpec: !hasSpec
        })
      })
    })
    
    // Sort: items that need spec first
    items.sort((a, b) => {
      if (a.needsSpec && !b.needsSpec) return -1
      if (!a.needsSpec && b.needsSpec) return 1
      return 0
    })
    
    return NextResponse.json({
      ok: true,
      items,
      stats: {
        total: items.length,
        needsSpec: items.filter(i => i.needsSpec).length,
        hasSpec: items.filter(i => i.hasSpec).length
      }
    })
    
  } catch (error) {
    console.error('Extension pending-items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
