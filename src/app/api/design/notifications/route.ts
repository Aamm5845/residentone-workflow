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

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Get all notifications related to the design stage
    // For now, we'll simulate notifications based on recent activity
    // In a real implementation, you'd have a notifications table
    
    // Get recent comments
    const recentComments = await prisma.comment.findMany({
      where: {
        stageId: stageId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        author: {
          select: { id: true, name: true }
        },
        section: {
          select: { type: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Get recent uploads
    const recentUploads = await prisma.asset.findMany({
      where: {
        stageId: stageId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        uploader: {
          select: { id: true, name: true }
        },
        section: {
          select: { type: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Transform to notification format
    const notifications = [
      ...recentComments.map(comment => ({
        id: `comment-${comment.id}`,
        type: 'comment' as const,
        sectionType: comment.section?.type || 'GENERAL',
        sectionName: getSectionName(comment.section?.type || 'GENERAL'),
        title: 'New comment added',
        message: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
        createdAt: comment.createdAt.toISOString(),
        read: false, // In real implementation, check against user's read status
        author: {
          name: comment.author.name || 'Unknown User',
          id: comment.author.id
        }
      })),
      ...recentUploads.map(asset => ({
        id: `upload-${asset.id}`,
        type: 'upload' as const,
        sectionType: asset.section?.type || 'GENERAL',
        sectionName: getSectionName(asset.section?.type || 'GENERAL'),
        title: 'New file uploaded',
        message: `${asset.title} has been uploaded`,
        createdAt: asset.createdAt.toISOString(),
        read: false,
        author: {
          name: asset.uploader?.name || 'Unknown User',
          id: asset.uploader?.id || 'unknown'
        }
      }))
    ]

    // Sort by creation date and limit
    const sortedNotifications = notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      notifications: sortedNotifications
    })

  } catch (error) {
    console.error('Error fetching design notifications:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getSectionName(sectionType: string): string {
  switch (sectionType) {
    case 'GENERAL': return 'General Design'
    case 'WALL_COVERING': return 'Wall Covering'
    case 'CEILING': return 'Ceiling Design'
    case 'FLOOR': return 'Floor Design'
    default: return 'Design Section'
  }
}