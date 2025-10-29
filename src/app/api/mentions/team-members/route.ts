import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user belongs to this organization
    if (session.user.orgId !== orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { orgId },
          { name: { not: null } },
          { name: { not: { startsWith: '[DELETED]' } } },
          { email: { not: { startsWith: 'deleted_' } } },
          { email: { in: ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'sami@meisnerinteriors.com', 'euvi.3d@gmail.com'] } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    
    const filteredUsers = users.filter(user => user.name) as Array<{ id: string; name: string; email: string; role: string }>

    return NextResponse.json({ 
      success: true,
      data: filteredUsers 
    })
    
  } catch (error) {
    console.error('Error fetching team members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}
