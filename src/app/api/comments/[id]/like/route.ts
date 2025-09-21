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

    // Check if user has already liked this comment
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId: comment.id
        }
      }
    })

    let isLiked = false
    let likeCount = 0

    if (existingLike) {
      // Unlike the comment
      await prisma.commentLike.delete({
        where: {
          id: existingLike.id
        }
      })
      isLiked = false
    } else {
      // Like the comment
      await prisma.commentLike.create({
        data: {
          userId: session.user.id,
          commentId: comment.id
        }
      })
      isLiked = true
    }

    // Get updated like count
    likeCount = await prisma.commentLike.count({
      where: {
        commentId: comment.id
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: isLiked ? ActivityActions.COMMENT_TAGGED : ActivityActions.COMMENT_UNTAGGED,
      entity: EntityTypes.COMMENT,
      entityId: comment.id,
      details: {
        action: isLiked ? 'liked' : 'unliked',
        likeCount
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      isLiked,
      likeCount
    })
  } catch (error) {
    console.error('Error toggling comment like:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}