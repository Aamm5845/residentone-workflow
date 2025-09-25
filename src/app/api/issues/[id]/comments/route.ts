import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  logActivity,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// Add a comment to an issue
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
    const { content } = data

    if (!content || !content.trim()) {
      return NextResponse.json({ 
        error: 'Comment content is required' 
      }, { status: 400 })
    }

    // Verify the issue exists
    const issue = await prisma.issue.findFirst({
      where: { id: resolvedParams.id }
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Create the comment
    const comment = await prisma.issueComment.create({
      data: {
        issueId: resolvedParams.id,
        content: content.trim(),
        authorId: session.user.id
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: 'ISSUE_COMMENT_ADDED',
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        issueTitle: issue.title,
        commentId: comment.id
      },
      ipAddress
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating issue comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}