import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { prisma } from '@/lib/prisma'

// GET - Fetch team members for @mention suggestions
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Query all approved team members in the organization for mentions
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { orgId: session.user.orgId },
          { name: { not: null } },
          { name: { not: { startsWith: '[DELETED]' } } },
          { email: { not: { startsWith: 'deleted_' } } },
          { approvalStatus: 'APPROVED' }
        ]
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
    
    const teamMembers = users.filter(user => user.name) as Array<{ id: string; name: string; email: string; role: string; image?: string | null }>

    return NextResponse.json({
      success: true,
      users: teamMembers, // Component expects 'users' key
      teamMembers // Also include teamMembers for backwards compatibility
    })

  } catch (error) {
    console.error('Error fetching team members for mentions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
