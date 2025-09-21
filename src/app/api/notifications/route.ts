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
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { readAt: null })
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        readAt: null
      }
    })

    return NextResponse.json({
      notifications,
      unreadCount
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

    // Validate the user exists and is in the same org
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        orgId: session.user.orgId
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: withCreateAttribution(session, {
        userId,
        type,
        title,
        message,
        relatedId,
        relatedType
      })
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
          readAt: null
        },
        data: {
          readAt: new Date(),
          updatedAt: new Date(),
          updatedById: session.user.id
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
          readAt: new Date(),
          updatedAt: new Date(),
          updatedById: session.user.id
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