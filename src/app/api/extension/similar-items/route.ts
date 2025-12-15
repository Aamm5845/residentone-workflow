import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key
async function getAuthenticatedUser(request: NextRequest) {
  const apiKey = request.headers.get('X-Extension-Key')
  
  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })
    
    if (token?.createdBy) {
      return token.createdBy
    }
  }
  
  return null
}

/**
 * GET /api/extension/similar-items
 * Find FFE items with similar names across all rooms in a project
 * Used for linking the same product to multiple locations (e.g., all toilets in a project)
 */
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
    const projectId = searchParams.get('projectId')
    const searchTerm = searchParams.get('searchTerm')
    const excludeItemId = searchParams.get('excludeItemId') // Item already selected
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    
    // Verify project belongs to user's organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: user.orgId
      }
    })
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    // Get all rooms with FFE items
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
                    visibility: 'VISIBLE',
                    isSpecItem: false,
                    ffeRequirementId: null
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
    
    // Build a flat list of all items with room/section context
    const allItems: Array<{
      id: string
      name: string
      roomId: string
      roomName: string
      sectionId: string
      sectionName: string
      hasSpec: boolean
      quantity: number
    }> = []
    
    rooms.forEach(room => {
      if (!room.ffeInstance) return
      
      const roomName = room.name || room.type.replace(/_/g, ' ')
      
      room.ffeInstance.sections.forEach(section => {
        section.items.forEach(item => {
          const customFields = (item.customFields as any) || {}
          const hasSpec = !!(
            item.supplierName || 
            item.supplierLink || 
            customFields.brand ||
            customFields.colour ||
            customFields.finish ||
            customFields.material
          )
          
          allItems.push({
            id: item.id,
            name: item.name,
            roomId: room.id,
            roomName,
            sectionId: section.id,
            sectionName: section.name,
            hasSpec,
            quantity: item.quantity || 1
          })
        })
      })
    })
    
    // If searchTerm provided, find similar items by name
    if (searchTerm) {
      // Normalize search term
      const searchLower = searchTerm.toLowerCase().trim()
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2)
      
      // Score each item by similarity
      const scoredItems = allItems
        .filter(item => item.id !== excludeItemId) // Exclude the selected item
        .map(item => {
          const nameLower = item.name.toLowerCase()
          let score = 0
          
          // Exact match
          if (nameLower === searchLower) {
            score = 100
          }
          // Contains exact search term
          else if (nameLower.includes(searchLower)) {
            score = 80
          }
          // Search term contains item name
          else if (searchLower.includes(nameLower)) {
            score = 70
          }
          // Word matching
          else {
            const nameWords = nameLower.split(/\s+/)
            const matchingWords = searchWords.filter(sw => 
              nameWords.some(nw => nw.includes(sw) || sw.includes(nw))
            )
            
            if (matchingWords.length > 0) {
              score = 30 + (matchingWords.length / searchWords.length) * 40
            }
          }
          
          return { ...item, score }
        })
        .filter(item => item.score > 20) // Minimum similarity threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, 20) // Limit results
      
      return NextResponse.json({
        ok: true,
        similarItems: scoredItems,
        searchTerm,
        totalItemsInProject: allItems.length
      })
    }
    
    // No search term - return all items grouped by name
    // Find items that appear in multiple rooms (potential for linking)
    const itemsByName = new Map<string, typeof allItems>()
    
    allItems.forEach(item => {
      const key = item.name.toLowerCase().trim()
      if (!itemsByName.has(key)) {
        itemsByName.set(key, [])
      }
      itemsByName.get(key)!.push(item)
    })
    
    // Return items that appear in multiple rooms
    const duplicateItems = Array.from(itemsByName.entries())
      .filter(([_, items]) => items.length > 1)
      .map(([name, items]) => ({
        name: items[0].name, // Use original casing
        count: items.length,
        items: items
      }))
      .sort((a, b) => b.count - a.count)
    
    return NextResponse.json({
      ok: true,
      duplicateItems,
      allItems,
      totalItemsInProject: allItems.length
    })
    
  } catch (error) {
    console.error('Extension similar-items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
