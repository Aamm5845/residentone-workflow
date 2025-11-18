import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/activities/mark-read
 * 
 * Updates the user's lastActivityViewedAt to the current timestamp,
 * marking all activities up to now as read.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Client will store timestamp in localStorage
    // No database update needed
    return NextResponse.json({
      success: true,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Error marking activities as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark activities as read' },
      { status: 500 }
    )
  }
}
