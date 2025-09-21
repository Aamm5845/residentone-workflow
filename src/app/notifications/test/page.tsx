'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotifications, NotificationTypes } from '@/hooks/useNotifications'
import { 
  notifyTaskAssignment,
  notifyTaskCompletion,
  notifyProjectUpdate,
  notifyDeadlineReminder,
  notifyMessage
} from '@/lib/notificationUtils'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export default function NotificationTestPage() {
  const { data: session } = useSession()
  const { notifications, unreadCount, fetchNotifications } = useNotifications()
  const [loading, setLoading] = useState(false)
  
  // Form states for manual notification creation
  const [notificationForm, setNotificationForm] = useState({
    type: NotificationTypes.TASK_ASSIGNMENT,
    title: '',
    message: '',
    relatedId: '',
    relatedType: ''
  })

  if (!session?.user) {
    return <div className="p-6">Please sign in to test notifications.</div>
  }

  const createSampleNotification = async () => {
    if (!notificationForm.title || !notificationForm.message) {
      toast.error('Please fill in title and message')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.user.id,
          type: notificationForm.type,
          title: notificationForm.title,
          message: notificationForm.message,
          relatedId: notificationForm.relatedId || null,
          relatedType: notificationForm.relatedType || null
        })
      })

      if (response.ok) {
        toast.success('Notification created successfully!')
        setNotificationForm({
          type: NotificationTypes.TASK_ASSIGNMENT,
          title: '',
          message: '',
          relatedId: '',
          relatedType: ''
        })
        fetchNotifications()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create notification')
      }
    } catch (error) {
      console.error('Error creating notification:', error)
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  const createSampleTaskAssignment = async () => {
    setLoading(true)
    try {
      await notifyTaskAssignment({
        assigneeId: session.user.id,
        assignerName: 'Test Manager',
        taskTitle: 'Create bedroom design concept',
        projectName: 'Luxury Penthouse Redesign',
        taskId: 'task-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      })
      toast.success('Task assignment notification created!')
      fetchNotifications()
    } catch (error) {
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  const createSampleTaskCompletion = async () => {
    setLoading(true)
    try {
      await notifyTaskCompletion({
        notifyUserId: session.user.id,
        completedByName: 'Jane Designer',
        taskTitle: 'Living room color palette',
        projectName: 'Downtown Loft Project',
        taskId: 'task-456'
      })
      toast.success('Task completion notification created!')
      fetchNotifications()
    } catch (error) {
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  const createSampleProjectUpdate = async () => {
    setLoading(true)
    try {
      await notifyProjectUpdate({
        userId: session.user.id,
        updatedByName: 'Project Manager',
        projectName: 'Modern Office Space',
        updateType: 'updated the timeline',
        projectId: 'project-789'
      })
      toast.success('Project update notification created!')
      fetchNotifications()
    } catch (error) {
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  const createSampleDeadlineReminder = async () => {
    setLoading(true)
    try {
      await notifyDeadlineReminder({
        userId: session.user.id,
        taskTitle: 'Final presentation prep',
        projectName: 'Executive Conference Room',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        taskId: 'task-999'
      })
      toast.success('Deadline reminder notification created!')
      fetchNotifications()
    } catch (error) {
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  const createSampleMessage = async () => {
    setLoading(true)
    try {
      await notifyMessage({
        userId: session.user.id,
        senderName: 'Client Sarah',
        messagePreview: 'Love the new color scheme! Can we adjust the lighting?',
        contextTitle: 'Master Bedroom Design',
        relatedId: 'room-abc',
        relatedType: 'ROOM'
      })
      toast.success('Message notification created!')
      fetchNotifications()
    } catch (error) {
      toast.error('Failed to create notification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Notification System Test</h1>
          <p className="text-gray-600 mt-2">
            Test the notification system by creating sample notifications. Check the bell icon in the header to see them.
          </p>
        </div>

        {/* Current Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
                <div className="text-sm text-gray-500">Total Notifications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
                <div className="text-sm text-gray-500">Unread</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{notifications.length - unreadCount}</div>
                <div className="text-sm text-gray-500">Read</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Sample Notifications */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Sample Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button 
                onClick={createSampleTaskAssignment} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                📋 Task Assignment
              </Button>
              <Button 
                onClick={createSampleTaskCompletion} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                ✅ Task Completion
              </Button>
              <Button 
                onClick={createSampleProjectUpdate} 
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                📄 Project Update
              </Button>
              <Button 
                onClick={createSampleDeadlineReminder} 
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                ⏰ Deadline Reminder
              </Button>
              <Button 
                onClick={createSampleMessage} 
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                💬 New Message
              </Button>
              <Button 
                onClick={fetchNotifications} 
                variant="outline"
                disabled={loading}
              >
                🔄 Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom Notification Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Custom Notification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Notification Type</Label>
                <Select 
                  value={notificationForm.type} 
                  onValueChange={(value) => setNotificationForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NotificationTypes).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {key.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Notification message"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="relatedId">Related ID (optional)</Label>
                  <Input
                    id="relatedId"
                    value={notificationForm.relatedId}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, relatedId: e.target.value }))}
                    placeholder="e.g. task-123, project-456"
                  />
                </div>

                <div>
                  <Label htmlFor="relatedType">Related Type (optional)</Label>
                  <Input
                    id="relatedType"
                    value={notificationForm.relatedType}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, relatedType: e.target.value }))}
                    placeholder="e.g. TASK, PROJECT, ROOM"
                  />
                </div>
              </div>

              <Button 
                onClick={createSampleNotification} 
                disabled={loading || !notificationForm.title || !notificationForm.message}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Custom Notification'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}