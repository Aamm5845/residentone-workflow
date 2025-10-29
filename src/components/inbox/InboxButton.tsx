'use client'

import React, { useState } from 'react'
import { Inbox, Dot, Check, CheckCheck, AtSign } from 'lucide-react'
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

interface InboxButtonProps {
  className?: string
}

export function InboxButton({ className }: InboxButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markSingleAsRead, 
    markAllAsRead,
    getNotificationsByType
  } = useNotifications({ limit: 50 })

  // Filter for only mention notifications
  const mentionNotifications = getNotificationsByType('MENTION')
  const unreadMentions = mentionNotifications.filter(n => !n.read)
  const unreadMentionCount = unreadMentions.length

  const handleMentionClick = async (notification: Notification) => {
    if (!notification.read) {
      await markSingleAsRead(notification.id)
    }
    
    // Handle navigation based on notification type and related data
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
    
    // Close the dropdown after navigation
    setIsOpen(false)
  }

  const handleMarkAllMentionsRead = async () => {
    const unreadMentionIds = unreadMentions.map(n => n.id)
    if (unreadMentionIds.length > 0) {
      for (const id of unreadMentionIds) {
        await markSingleAsRead(id)
      }
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative p-2 ${className}`}
          title="Inbox - @mentions"
        >
          <Inbox size={18} />
          {unreadMentionCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadMentionCount > 99 ? '99+' : unreadMentionCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuHeader className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AtSign size={16} className="text-indigo-600" />
            <span className="font-semibold">Mentions</span>
          </div>
          {unreadMentionCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleMarkAllMentionsRead()
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
            Loading mentions...
          </div>
        )}
        
        {error && (
          <div className="p-4 text-center text-sm text-red-500">
            Error loading mentions
          </div>
        )}
        
        {!loading && !error && mentionNotifications.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            <AtSign size={24} className="mx-auto mb-2 text-gray-300" />
            <p>No mentions yet</p>
            <p className="text-xs mt-1">When someone @mentions you, it will appear here</p>
          </div>
        )}
        
        {!loading && !error && mentionNotifications.length > 0 && (
          <ScrollArea className="max-h-96">
            {mentionNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-0 focus:bg-gray-50"
                onSelect={() => handleMentionClick(notification)}
              >
                <div className="flex items-start space-x-3 p-3 w-full">
                  {/* Mention Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">
                    <AtSign size={14} />
                  </div>
                  
                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
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
                  {!notification.read && (
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
        
        {mentionNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 text-center text-xs text-gray-500">
              {mentionNotifications.length} mention{mentionNotifications.length !== 1 ? 's' : ''} total
              {unreadMentionCount > 0 && (
                <span className="ml-2 text-indigo-600 font-medium">
                  {unreadMentionCount} unread
                </span>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default InboxButton
