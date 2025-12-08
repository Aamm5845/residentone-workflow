import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key or session
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
  
  const session = await getSession()
  
  if (!session?.user?.email) {
    return null
  }
  
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true
    }
  })
  
  return user
}

// GET: Get FFE sections for a room
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    // Get roomId from query params
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
              select: {
                id: true,
                name: true,
                description: true,
                order: true,
                isCompleted: true,
                _count: {
                  select: {
                    items: true
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    // If room has no FFE instance yet, return default sections from library
    if (!room.ffeInstance) {
      // Get default sections from FFE Section Library
      const librarySections = await prisma.fFESectionLibrary.findMany({
        where: {
          isGlobal: true,
          applicableRoomTypes: {
            has: room.type
          }
        },
        select: {
          id: true,
          name: true,
          description: true,
          defaultOrder: true
        },
        orderBy: { defaultOrder: 'asc' }
      })
      
      // If no library sections found, return common defaults
      if (librarySections.length === 0) {
        const defaultSections = [
          { id: 'new_flooring', name: 'Flooring', description: 'Floor materials and finishes', order: 1 },
          { id: 'new_walls', name: 'Walls', description: 'Wall treatments and finishes', order: 2 },
          { id: 'new_ceiling', name: 'Ceiling', description: 'Ceiling treatments', order: 3 },
          { id: 'new_lighting', name: 'Lighting', description: 'Light fixtures', order: 4 },
          { id: 'new_furniture', name: 'Furniture', description: 'Furniture pieces', order: 5 },
          { id: 'new_fixtures', name: 'Fixtures', description: 'Plumbing and other fixtures', order: 6 },
          { id: 'new_accessories', name: 'Accessories', description: 'Decorative items', order: 7 }
        ]
        
        return NextResponse.json({
          ok: true,
          sections: defaultSections,
          isNewInstance: true,
          message: 'No FFE instance exists. Default sections will be created when first item is clipped.'
        })
      }
      
      return NextResponse.json({
        ok: true,
        sections: librarySections.map(s => ({
          id: `lib_${s.id}`,
          name: s.name,
          description: s.description,
          order: s.defaultOrder,
          itemCount: 0
        })),
        isNewInstance: true,
        message: 'No FFE instance exists. Sections from library will be used.'
      })
    }
    
    // Return existing sections
    const sections = room.ffeInstance.sections.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      order: s.order,
      isCompleted: s.isCompleted,
      itemCount: s._count.items
    }))
    
    return NextResponse.json({
      ok: true,
      sections,
      instanceId: room.ffeInstance.id,
      isNewInstance: false
    })
    
  } catch (error) {
    console.error('Extension sections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
