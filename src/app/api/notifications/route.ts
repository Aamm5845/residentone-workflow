import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  withCreateAttribution,
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// GET - Fetch user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const type = searchParams.get('type')
    const relatedType = searchParams.get('relatedType')

    // Build filter conditions
    const where: any = {
      userId: session.user.id,
      ...(unreadOnly && { read: false }),
      ...(type && { type }),
      ...(relatedType && { relatedType })
    }

    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId: session.user.id,
          read: false
        }
      })
    ])

    // Group notifications by type for stats
    const notificationStats = await prisma.notification.groupBy({
      by: ['type'],
      where: { userId: session.user.id },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      stats: {
        totalNotifications: total,
        unreadCount,
        typeBreakdown: notificationStats.map(s => ({
          type: s.type,
          count: s._count.id
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { userId, type, title, message, relatedId, relatedType } = data

    if (!userId || !type || !title || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, type, title, message' 
      }, { status: 400 })
    }

    // Validate the user exists
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedId,
        relatedType
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.NOTIFICATION_CREATED,
      entity: EntityTypes.NOTIFICATION,
      entityId: notification.id,
      details: {
        notificationType: type,
        recipientId: userId,
        recipientName: targetUser.name,
        title,
        relatedType,
        relatedId
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      notification
    })

  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { notificationIds, markAllAsRead } = data

    if (markAllAsRead) {
      // Mark all user's notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false
        },
        data: {
          read: true,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id // Ensure user can only mark their own notifications
        },
        data: {
          read: true,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: `${notificationIds.length} notifications marked as read`
      })
    }

    return NextResponse.json({ 
      error: 'Either notificationIds array or markAllAsRead must be provided' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationIds = searchParams.get('ids')?.split(',') || []
    const deleteAll = searchParams.get('deleteAll') === 'true'
    const deleteRead = searchParams.get('deleteRead') === 'true'

    if (deleteAll) {
      // Delete all notifications
      const result = await prisma.notification.deleteMany({
        where: { userId: session.user.id }
      })

      await logActivity({
        session,
        action: ActivityActions.NOTIFICATION_DELETED,
        entity: EntityTypes.NOTIFICATION,
        entityId: 'bulk',
        details: {
          deletionType: 'all',
          deletedCount: result.count
        },
        ipAddress
      })

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${result.count} notifications` 
      })
    } else if (deleteRead) {
      // Delete only read notifications
      const result = await prisma.notification.deleteMany({
        where: {
          userId: session.user.id,
          read: true
        }
      })

      await logActivity({
        session,
        action: ActivityActions.NOTIFICATION_DELETED,
        entity: EntityTypes.NOTIFICATION,
        entityId: 'bulk',
        details: {
          deletionType: 'read',
          deletedCount: result.count
        },
        ipAddress
      })

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${result.count} read notifications` 
      })
    } else if (notificationIds.length > 0) {
      // Delete specific notifications
      const result = await prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id
        }
      })

      await logActivity({
        session,
        action: ActivityActions.NOTIFICATION_DELETED,
        entity: EntityTypes.NOTIFICATION,
        entityId: 'bulk',
        details: {
          deletionType: 'specific',
          notificationIds,
          deletedCount: result.count
        },
        ipAddress
      })

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${result.count} notifications` 
      })
    } else {
      return NextResponse.json({ 
        error: 'No deletion criteria provided' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error deleting notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
