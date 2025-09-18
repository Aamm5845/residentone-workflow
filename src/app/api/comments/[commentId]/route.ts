import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        name: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { content } = data

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Find the comment and verify ownership/access
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.commentId,
        OR: [
          { authorId: session.user.id }, // Comment owner
          { 
            project: { orgId: session.user.orgId } // Same organization
          }
        ]
      },
      include: {
        author: { select: { name: true } },
        project: { select: { orgId: true } }
      }
    })

    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
    }

    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id: resolvedParams.commentId },
      data: { 
        content: content.trim(),
        updatedAt: new Date()
      },
      include: {
        author: { select: { name: true } }
      }
    })

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        name: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the comment and verify ownership/access
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.commentId,
        OR: [
          { authorId: session.user.id }, // Comment owner
          { 
            project: { orgId: session.user.orgId } // Same organization with admin rights
          }
        ]
      },
      include: {
        project: { select: { orgId: true } }
      }
    })

    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
    }

    // Delete the comment
    await prisma.comment.delete({
      where: { id: resolvedParams.commentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}