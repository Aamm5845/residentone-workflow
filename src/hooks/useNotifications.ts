import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  readAt: string | null
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
}

export function useNotifications({
  unreadOnly = false,
  limit = 50,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: UseNotificationsOptions = {}) {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)

    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [session, unreadOnly, limit])

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
              ? { ...notif, readAt: new Date().toISOString() }
              : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
      } else {
        // Mark all as read
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, readAt: new Date().toISOString() }))
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
    return notifications.filter(notif => !notif.readAt)
  }, [notifications])

  // Get notifications by type
  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(notif => notif.type === type)
  }, [notifications])

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

// Notification types enum for consistency
export const NotificationTypes = {
  TASK_ASSIGNMENT: 'TASK_ASSIGNMENT',
  TASK_COMPLETION: 'TASK_COMPLETION',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  DEADLINE_REMINDER: 'DEADLINE_REMINDER',
  MESSAGE: 'MESSAGE',
  MENTION: 'MENTION',
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_RESPONSE: 'APPROVAL_RESPONSE',
  SYSTEM: 'SYSTEM'
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]