import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { isPinned } = data

    // Find comment and verify access
    const comment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.id,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Check if user has already pinned this comment or is the author
    const existingPin = await prisma.commentPin.findFirst({
      where: {
        userId: session.user.id,
        commentId: comment.id
      }
    })

    if (isPinned && !existingPin) {
      // Pin the comment
      await prisma.commentPin.create({
        data: {
          userId: session.user.id,
          commentId: comment.id
        }
      })
    } else if (!isPinned && existingPin) {
      // Unpin the comment
      await prisma.commentPin.delete({
        where: {
          id: existingPin.id
        }
      })
    }

    // Log the activity
    await logActivity({
      session,
      action: isPinned ? ActivityActions.COMMENT_PINNED : ActivityActions.COMMENT_UNPINNED,
      entity: EntityTypes.COMMENT,
      entityId: comment.id,
      details: {
        action: isPinned ? 'pinned' : 'unpinned'
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      isPinned
    })
  } catch (error) {
    console.error('Error toggling comment pin:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}