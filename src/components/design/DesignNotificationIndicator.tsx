'use client'

import React, { useState, useEffect } from 'react'
import { Bell, BellDot, X, Eye, MessageSquare, Upload, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface DesignNotification {
  id: string
  type: 'comment' | 'upload' | 'edit' | 'mention'
  sectionType: 'GENERAL' | 'WALL_COVERING' | 'CEILING' | 'FLOOR'
  sectionName: string
  title: string
  message: string
  createdAt: string
  read: boolean
  author: {
    name: string
    id: string
  }
  roomName?: string
  projectName?: string
}

interface DesignNotificationIndicatorProps {
  stageId: string
  className?: string
}

const NOTIFICATION_ICONS = {
  comment: MessageSquare,
  upload: Upload,
  edit: Edit3,
  mention: MessageSquare
}

const NOTIFICATION_COLORS = {
  comment: 'text-blue-500',
  upload: 'text-green-500',
  edit: 'text-purple-500',
  mention: 'text-orange-500'
}

export default function DesignNotificationIndicator({ 
  stageId, 
  className = '' 
}: DesignNotificationIndicatorProps) {
  const [notifications, setNotifications] = useState<DesignNotification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load notifications on mount and setup polling
  useEffect(() => {
    loadNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    
    return () => clearInterval(interval)
  }, [stageId])

  const loadNotifications = async () => {
    if (!stageId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/design/notifications?stageId=${stageId}`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error loading design notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/design/notifications/${notificationId}/read`, {
        method: 'PATCH'
      })
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`/api/design/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId })
      })
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const hasUnread = unreadCount > 0

  const getSectionColor = (sectionType: string) => {
    switch (sectionType) {
      case 'GENERAL': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'WALL_COVERING': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'CEILING': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'FLOOR': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getSectionIcon = (sectionType: string) => {
    switch (sectionType) {
      case 'GENERAL': return '✨'
      case 'WALL_COVERING': return '🎨'
      case 'CEILING': return '⬆️'
      case 'FLOOR': return '⬇️'
      default: return '📄'
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPanel(!showPanel)}
        className="relative"
      >
        {hasUnread ? <BellDot className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Notification Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Design Updates</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                  <Bell className="w-8 h-8 mb-3" />
                  <p className="text-sm">No design updates yet</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {notifications.map((notification) => {
                    const Icon = NOTIFICATION_ICONS[notification.type]
                    const iconColor = NOTIFICATION_COLORS[notification.type]
                    
                    return (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          notification.read 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'bg-white border-purple-200 shadow-sm'
                        }`}
                        onClick={() => {
                          if (!notification.read) {
                            markAsRead(notification.id)
                          }
                          setShowPanel(false)
                          // You could scroll to the relevant section here
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-1 rounded-full bg-white border`}>
                            <Icon className={`w-3 h-3 ${iconColor}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSectionColor(notification.sectionType)}`}>
                                {getSectionIcon(notification.sectionType)} {notification.sectionName}
                              </span>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-xs text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>by {notification.author.name}</span>
                              <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadNotifications}
                className="text-xs text-gray-600"
              >
                🔄 Refresh notifications
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
