import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count issues that are not resolved or closed
    const unresolvedCount = await prisma.issue.count({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    // Get high priority unresolved issues count
    const highPriorityCount = await prisma.issue.count({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        },
        priority: {
          in: ['HIGH', 'URGENT']
        }
      }
    })

    return NextResponse.json({
      unresolvedCount,
      highPriorityCount
    })
  } catch (error) {
    console.error('Error fetching unresolved issue count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
