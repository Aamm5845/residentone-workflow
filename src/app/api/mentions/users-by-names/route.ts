import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { names, orgId } = await request.json()
    
    if (!orgId || !Array.isArray(names)) {
      return NextResponse.json({ error: 'Organization ID and names array required' }, { status: 400 })
    }

    // Verify user belongs to this organization
    if (session.user.orgId !== orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (names.length === 0) {
      return NextResponse.json({ 
        success: true,
        data: []
      })
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { orgId },
          { name: { not: { startsWith: '[DELETED]' } } },
          { email: { not: { startsWith: 'deleted_' } } },
          { email: { in: ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'sami@meisnerinteriors.com', 'euvi.3d@gmail.com'] } },
          {
            OR: names.map((name: string) => ({
              name: {
                contains: name,
                mode: 'insensitive'
              }
            }))
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    return NextResponse.json({ 
      success: true,
      data: users 
    })
    
  } catch (error) {
    console.error('Error finding users by names:', error)
    return NextResponse.json(
      { error: 'Failed to find users' },
      { status: 500 }
    )
  }
}
