'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle } from 'lucide-react'
import { requestNotificationPermission } from '@/lib/notifications'

export default function NotificationSettings() {
  const [desktopEnabled, setDesktopEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
      setDesktopEnabled(Notification.permission === 'granted')
    }
  }, [])

  const handleEnableDesktopNotifications = async () => {
    const granted = await requestNotificationPermission()
    if (granted) {
      setPermission('granted')
      setDesktopEnabled(true)
      
      // Send a test notification
      new Notification('Desktop Notifications Enabled!', {
        body: 'You will now receive notifications when someone mentions you in chat.',
        icon: '/icon.png',
      })
    } else {
      setPermission(Notification.permission)
      setDesktopEnabled(false)
    }
  }

  const handleDisableDesktopNotifications = () => {
    setDesktopEnabled(false)
    // Note: Can't revoke browser permission programmatically
    // User must do it in browser settings
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Desktop Notifications
        </CardTitle>
        <CardDescription>
          Get notified on your Windows PC when someone mentions you in chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">@Mention Notifications</p>
            <p className="text-xs text-muted-foreground">
              Receive desktop alerts when mentioned
            </p>
          </div>
          <Switch
            checked={desktopEnabled}
            onCheckedChange={(checked) => {
              if (checked) {
                handleEnableDesktopNotifications()
              } else {
                handleDisableDesktopNotifications()
              }
            }}
          />
        </div>

        {permission === 'denied' && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="flex items-start gap-2">
              <BellOff className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1 text-xs text-red-700">
                <p className="font-medium">Notifications Blocked</p>
                <p className="mt-1">
                  You've blocked notifications. To enable them:
                </p>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  <li>Click the lock icon in your browser's address bar</li>
                  <li>Find "Notifications" and change to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {permission === 'granted' && desktopEnabled && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Desktop notifications are enabled</span>
            </div>
          </div>
        )}

        {permission === 'granted' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              new Notification('Test Notification', {
                body: 'This is how mention notifications will look!',
                icon: '/icon.png',
              })
            }}
          >
            Send Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
