import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { getTeamMembersForMentions } from '@/lib/mentionUtils'
import { isValidAuthSession } from '@/lib/attribution'

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

    const teamMembers = await getTeamMembersForMentions(session.user.orgId)

    return NextResponse.json({
      success: true,
      teamMembers
    })

  } catch (error) {
    console.error('Error fetching team members for mentions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
