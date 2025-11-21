import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/users
 * Fetch users in the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch all users in the organization
    const users = await prisma.user.findMany({
      where: {
        orgId: session.user.orgId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(users)
    
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
