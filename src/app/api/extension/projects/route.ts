import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key or session
async function getAuthenticatedUser(request: NextRequest) {
  // First try API key
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
  
  // Fall back to session
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
