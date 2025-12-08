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

// GET: Get rooms for a project
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    // Get projectId from query params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    
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
    
    // Get rooms with their sections for the project
    const rooms = await prisma.room.findMany({
      where: {
        projectId: projectId
      },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        section: {
          select: {
            id: true,
            name: true
          }
        },
        ffeInstance: {
          select: {
            id: true,
            status: true,
            progress: true,
            _count: {
              select: {
                sections: true
              }
            }
          }
        }
      },
      orderBy: [
        { section: { order: 'asc' } },
        { order: 'asc' }
      ]
    })
    
    // Format response with display names
    const formattedRooms = rooms.map(room => ({
      id: room.id,
      type: room.type,
      name: room.name || formatRoomType(room.type),
      displayName: room.name || formatRoomType(room.type),
      status: room.status,
      groupName: room.section?.name || 'Ungrouped',
      hasFFEInstance: !!room.ffeInstance,
      ffeProgress: room.ffeInstance?.progress || 0,
      ffeSectionCount: room.ffeInstance?._count?.sections || 0
    }))
    
    return NextResponse.json({
      ok: true,
      rooms: formattedRooms
    })
    
  } catch (error) {
    console.error('Extension rooms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper to format room type for display
function formatRoomType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
