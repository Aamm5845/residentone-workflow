import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

// GET /api/chat/team-members - Get team members for @mention autocomplete
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active team members except the current user
    const teamMembers = await prisma.user.findMany({
      where: {
        orgId: { not: null }, // Only active users
        id: { not: session.user.id } // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      teamMembers
    })

  } catch (error) {
    console.error('Error fetching team members for mentions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
