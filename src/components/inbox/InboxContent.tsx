'use client'

import React, { useState } from 'react'
import { useNotifications, Notification } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { 
  AtSign, 
  ExternalLink, 
  CheckCheck, 
  Clock, 
  User,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function InboxContent() {
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  
  const { 
    notifications,
    loading, 
    error, 
    markSingleAsRead, 
    markAllAsRead,
    getNotificationsByType
  } = useNotifications({ limit: 100 })

  // Filter for only mention notifications
  const mentionNotifications = getNotificationsByType('MENTION')
  const unreadMentions = mentionNotifications.filter(n => !n.read)
  const readMentions = mentionNotifications.filter(n => n.read)

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markSingleAsRead(notification.id)
    }
    
    // Navigate to the related content
    if (notification.relatedId && notification.relatedType) {
      let navigateUrl = ''
      
      switch (notification.relatedType) {
        case 'STAGE':
          navigateUrl = `/stages/${notification.relatedId}`
          break
        case 'PROJECT':
          navigateUrl = `/projects/${notification.relatedId}`
          break
        case 'ROOM':
          navigateUrl = `/rooms/${notification.relatedId}`
          break
        case 'COMMENT':
        case 'MESSAGE':
          // For mentions in comments/messages, navigate to the stage
          navigateUrl = `/stages/${notification.relatedId}`
          break
        default:
          
          return
      }
      
      if (navigateUrl) {
        window.location.href = navigateUrl
      }
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadMentions.length > 0) {
      const unreadIds = unreadMentions.map(n => n.id)
      for (const id of unreadIds) {
        await markSingleAsRead(id)
      }
    }
  }

  const toggleSelection = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications)
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId)
    } else {
      newSelected.add(notificationId)
    }
    setSelectedNotifications(newSelected)
  }

  const handleBulkMarkRead = async () => {
    const selectedUnread = Array.from(selectedNotifications).filter(id => {
      const notification = mentionNotifications.find(n => n.id === id)
      return notification && !notification.read
    })
    
    for (const id of selectedUnread) {
      await markSingleAsRead(id)
    }
    setSelectedNotifications(new Set())
  }

  const renderNotification = (notification: Notification) => {
    const isSelected = selectedNotifications.has(notification.id)
    const isUnread = !notification.read
    
    return (
      <Card 
        key={notification.id}
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isUnread ? "border-l-4 border-l-indigo-500 bg-indigo-50/50" : "border-l-4 border-l-transparent",
          isSelected && "ring-2 ring-indigo-500 ring-offset-2"
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                <AtSign size={16} className="text-white" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h3 className={cn(
                  "text-sm font-medium text-gray-900",
                  isUnread && "font-semibold"
                )}>
                  {notification.title}
                </h3>
                
                <div className="flex items-center space-x-2 ml-4">
                  {isUnread && (
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                      New
                    </Badge>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelection(notification.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2",
                      isSelected 
                        ? "bg-indigo-500 border-indigo-500" 
                        : "border-gray-300 hover:border-indigo-500"
                    )}>
                      {isSelected && (
                        <CheckCheck size={12} className="text-white" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                {notification.message}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Clock size={12} />
                    <span>
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {notification.relatedType && (
                    <div className="flex items-center space-x-1">
                      <MessageSquare size={12} />
                      <span className="capitalize">
                        {notification.relatedType.toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNotificationClick(notification)
                  }}
                >
                  <ExternalLink size={12} className="mr-1" />
                  View
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading your mentions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AtSign className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-red-800">Error Loading Mentions</h3>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (mentionNotifications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AtSign className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No mentions yet</h3>
        <p className="text-gray-600 max-w-sm mx-auto">
          When someone @mentions you in comments or chats, they'll appear here so you never miss important messages.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <AtSign className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Mentions ({mentionNotifications.length})
            </h2>
          </div>
          
          {unreadMentions.length > 0 && (
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
              {unreadMentions.length} unread
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedNotifications.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkMarkRead}
            >
              Mark Selected Read ({selectedNotifications.size})
            </Button>
          )}
          
          {unreadMentions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {/* Unread Mentions */}
        {unreadMentions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Unread ({unreadMentions.length})
            </h3>
            <div className="space-y-3 group">
              {unreadMentions.map(renderNotification)}
            </div>
          </div>
        )}

        {/* Read Mentions */}
        {readMentions.length > 0 && (
          <div className={cn(
            unreadMentions.length > 0 && "mt-8 pt-8 border-t border-gray-200"
          )}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
              Read ({readMentions.length})
            </h3>
            <div className="space-y-3 group opacity-75">
              {readMentions.map(renderNotification)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
