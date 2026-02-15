import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks/count - Get pending task count for sidebar badge
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ count: 0 })
    }

    const count = await prisma.task.count({
      where: {
        assignedToId: session.user.id,
        status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] }
      }
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching task count:', error)
    return NextResponse.json({ count: 0 })
  }
}
