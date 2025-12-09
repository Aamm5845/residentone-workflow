'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { sendMentionNotification, requestNotificationPermission } from '@/lib/notifications'

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  read: boolean
  relatedId?: string | null
  relatedType?: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationResponse {
  notifications: Notification[]
  unreadCount: number
}

interface UseNotificationsOptions {
  unreadOnly?: boolean
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  enableDesktopNotifications?: boolean
}

export function useNotifications({
  unreadOnly = false,
  limit = 50,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  enableDesktopNotifications = true
}: UseNotificationsOptions = {}) {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0)
  
  // Track which notification IDs have already triggered desktop notifications
  // This persists across renders to prevent duplicate desktop alerts
  const shownDesktopNotificationIds = useRef<Set<string>>(new Set())

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(unreadOnly && { unreadOnly: 'true' })
      })

      const response = await fetch(`/api/notifications?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch notifications')
      }

      const data: NotificationResponse = await response.json()
      
      // Check for new mention notifications for desktop alerts
      if (enableDesktopNotifications && data.notifications.length > 0) {
        const newMentions = data.notifications.filter(
          n => n.type === 'MENTION' && !n.read && 
          !shownDesktopNotificationIds.current.has(n.id)
        )
        
        // Send desktop notification for each new mention
        newMentions.forEach(mention => {
          // Mark as shown BEFORE sending to prevent race conditions
          shownDesktopNotificationIds.current.add(mention.id)
          const mentionedBy = mention.title.replace(' mentioned you', '')
          const link = mention.relatedId ? `/stages/${mention.relatedId}` : undefined
          sendMentionNotification(mentionedBy, mention.message, link)
        })
      }
      
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
      setPreviousUnreadCount(data.unreadCount)

    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [session, unreadOnly, limit, enableDesktopNotifications])

  // Create notification
  const createNotification = useCallback(async (notificationData: {
    userId: string
    type: string
    title: string
    message: string
    relatedId?: string
    relatedType?: string
  }) => {
    if (!session?.user) {
      throw new Error('User not authenticated')
    }

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create notification')
      }

      const result = await response.json()
      
      // Refresh notifications if we're showing all or if this is for the current user
      if (!unreadOnly || notificationData.userId === session.user.id) {
        await fetchNotifications()
      }

      return result.notification

    } catch (err) {
      console.error('Error creating notification:', err)
      throw err
    }
  }, [session, unreadOnly, fetchNotifications])

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds?: string[]) => {
    if (!session?.user) return

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          notificationIds 
            ? { notificationIds }
            : { markAllAsRead: true }
        )
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mark notifications as read')
      }

      // Update local state
      if (notificationIds) {
        setNotifications(prev => 
          prev.map(notif => 
            notificationIds.includes(notif.id) 
              ? { ...notif, read: true }
              : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
      } else {
        // Mark all as read
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        )
        setUnreadCount(0)
      }

    } catch (err) {
      console.error('Error marking notifications as read:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark notifications as read')
    }
  }, [session])

  // Mark single notification as read
  const markSingleAsRead = useCallback(async (notificationId: string) => {
    await markAsRead([notificationId])
  }, [markAsRead])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    await markAsRead()
  }, [markAsRead])

  // Get unread notifications only
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(notif => !notif.read)
  }, [notifications])

  // Get notifications by type
  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(notif => notif.type === type)
  }, [notifications])

  // Request notification permission on mount
  useEffect(() => {
    if (enableDesktopNotifications && session?.user) {
      requestNotificationPermission()
    }
  }, [enableDesktopNotifications, session])

  // Initial fetch
  useEffect(() => {
    if (session?.user) {
      fetchNotifications()
    }
  }, [fetchNotifications, session])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !session?.user) return

    const interval = setInterval(fetchNotifications, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchNotifications, session])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    // Actions
    fetchNotifications,
    createNotification,
    markAsRead,
    markSingleAsRead,
    markAllAsRead,
    // Utilities
    getUnreadNotifications,
    getNotificationsByType,
    // State helpers
    hasUnread: unreadCount > 0,
    isEmpty: notifications.length === 0
  }
}

// Notification types enum for consistency (matches Prisma schema)
export const NotificationTypes = {
  STAGE_ASSIGNED: 'STAGE_ASSIGNED',
  STAGE_COMPLETED: 'STAGE_COMPLETED',
  MENTION: 'MENTION',
  DUE_DATE_REMINDER: 'DUE_DATE_REMINDER',
  PROJECT_UPDATE: 'PROJECT_UPDATE'
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]
