import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'

interface RouteContext {
  params: Promise<{ roomId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const logs = await prisma.activityLog.findMany({
      where: { entity: 'FFE_ITEM' },
      orderBy: { createdAt: 'desc' },
      take: limit * 3, // Get more to filter
      include: {
        actor: { select: { id: true, name: true, email: true } }
      }
    })

    // Filter by roomId in details
    const roomLogs = logs.filter(log => {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
        return details?.roomId === roomId
      } catch { return false }
    }).slice(0, limit)

    return NextResponse.json({ success: true, logs: roomLogs })
  } catch (error) {
    console.error('Error fetching FFE activity:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await context.params
    const { itemId, itemName, sectionName, previousState, newState } = await request.json()

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { project: { select: { orgId: true } } }
    })

    const log = await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'STATE_CHANGE',
        entity: 'FFE_ITEM',
        entityId: itemId,
        orgId: room?.project?.orgId,
        details: { roomId, itemId, itemName, sectionName, previousState, newState }
      },
      include: { actor: { select: { id: true, name: true, email: true } } }
    })

    return NextResponse.json({ success: true, log })
  } catch (error) {
    console.error('Error creating FFE activity:', error)
    return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 })
  }
}
