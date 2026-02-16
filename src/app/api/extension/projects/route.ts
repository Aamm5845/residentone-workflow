import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/extension-auth'

// GET: Get user's projects for the extension
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    // Get projects for the user's organization
    const projects = await prisma.project.findMany({
      where: {
        orgId: user.orgId
      },
      select: {
        id: true,
        name: true,
        status: true,
        client: {
          select: {
            name: true,
            email: true,
          }
        },
        _count: {
          select: {
            rooms: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' }
      ],
      take: 50 // Limit for performance
    })
    
    // Format response
    const formattedProjects = projects.map(p => ({
      id: p.id,
      name: p.name,
      clientName: p.client?.name || 'No Client',
      clientEmail: p.client?.email || '',
      status: p.status,
      roomCount: p._count.rooms
    }))
    
    return NextResponse.json({
      ok: true,
      projects: formattedProjects
    })
    
  } catch (error) {
    console.error('Extension projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
