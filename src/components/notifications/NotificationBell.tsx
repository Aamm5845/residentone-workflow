'use client'

import React, { useState } from 'react'
import { Bell, Dot, Check, CheckCheck, X } from 'lucide-react'
import { useNotifications, Notification } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markSingleAsRead, 
    markAllAsRead,
    hasUnread 
  } = useNotifications({ limit: 20 })

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await markSingleAsRead(notification.id)
    }
    
    // Handle navigation based on notification type and related data
    if (notification.relatedId && notification.relatedType) {
      // Navigate to related entity (project, task, etc.)
      // This would depend on your routing structure
      console.log('Navigate to:', notification.relatedType, notification.relatedId)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNMENT':
        return '📋'
      case 'TASK_COMPLETION':
        return '✅'
      case 'PROJECT_UPDATE':
        return '📄'
      case 'DEADLINE_REMINDER':
        return '⏰'
      case 'MESSAGE':
        return '💬'
      case 'MENTION':
        return '💬'
      case 'APPROVAL_REQUEST':
        return '🔍'
      case 'APPROVAL_RESPONSE':
        return '✅'
      default:
        return '📢'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNMENT':
        return 'bg-blue-500'
      case 'TASK_COMPLETION':
        return 'bg-green-500'
      case 'PROJECT_UPDATE':
        return 'bg-purple-500'
      case 'DEADLINE_REMINDER':
        return 'bg-orange-500'
      case 'MESSAGE':
      case 'MENTION':
        return 'bg-indigo-500'
      case 'APPROVAL_REQUEST':
      case 'APPROVAL_RESPONSE':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative p-2 ${className}`}
        >
          <Bell size={18} />
          {hasUnread && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuHeader className="flex items-center justify-between">
          <span className="font-semibold">Notifications</span>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                markAllAsRead()
              }}
              className="h-6 px-2 text-xs"
            >
              <CheckCheck size={12} className="mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuHeader>
        
        <DropdownMenuSeparator />
        
        {loading && (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading notifications...
          </div>
        )}
        
        {error && (
          <div className="p-4 text-center text-sm text-red-500">
            Error loading notifications
          </div>
        )}
        
        {!loading && !error && notifications.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No notifications yet
          </div>
        )}
        
        {!loading && !error && notifications.length > 0 && (
          <ScrollArea className="max-h-96">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-0 focus:bg-gray-50"
                onSelect={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3 p-3 w-full">
                  {/* Notification Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${getNotificationColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className={`text-sm ${!notification.readAt ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      {!notification.readAt && (
                        <Dot className="text-blue-500 flex-shrink-0" size={20} />
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                      {notification.message}
                    </p>
                    
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  
                  {/* Mark as read button */}
                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        markSingleAsRead(notification.id)
                      }}
                    >
                      <Check size={12} />
                    </Button>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-center text-blue-600 hover:text-blue-800"
              onSelect={() => {
                // Navigate to full notifications page
                console.log('Navigate to notifications page')
              }}
            >
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell