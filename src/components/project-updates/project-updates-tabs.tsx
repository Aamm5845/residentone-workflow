'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock } from 'lucide-react'
import PhotoGallery from './photo-gallery'
import TaskBoard from './task-board'
import ChatInterface from './chat-interface'
import Timeline from './timeline'

interface ProjectUpdatesTabsProps {
  projectId: string
  project: any
  projectUpdates: any[]
  photos: any[]
  tasks: any[]
  availableUsers: any[]
  availableContractors: any[]
}

export default function ProjectUpdatesTabs({
  projectId,
  project,
  projectUpdates,
  photos,
  tasks,
  availableUsers,
  availableContractors
}: ProjectUpdatesTabsProps) {
  const [messages, setMessages] = useState<any[]>([
    {
      id: '1',
      content: 'Great progress on the kitchen electrical work! The outlets look professionally installed.',
      authorId: availableUsers[0]?.id || 'user1',
      author: availableUsers[0] || { id: 'user1', name: 'Project Manager', email: 'pm@example.com' },
      messageType: 'MESSAGE' as const,
      priority: 'NORMAL' as const,
      mentions: [],
      attachments: [],
      reactions: [{ emoji: '👍', users: [{ id: 'user2', name: 'Contractor' }] }],
      readBy: [{ userId: availableUsers[0]?.id || 'user1', userName: availableUsers[0]?.name || 'User', readAt: '2024-01-15T10:00:00Z' }],
      isUrgent: false,
      isEdited: false,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      content: 'Thanks! The GFCI outlets are all tested and working properly. Ready for the next phase.',
      authorId: availableUsers[1]?.id || 'user2',
      author: availableUsers[1] || { id: 'user2', name: 'Electrician', email: 'electrician@example.com' },
      messageType: 'MESSAGE' as const,
      priority: 'NORMAL' as const,
      mentions: [availableUsers[0]?.id || 'user1'],
      attachments: [],
      reactions: [],
      readBy: [{ userId: availableUsers[1]?.id || 'user2', userName: availableUsers[1]?.name || 'User', readAt: '2024-01-15T11:00:00Z' }],
      isUrgent: false,
      isEdited: false,
      createdAt: '2024-01-15T11:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z'
    }
  ])

  const [timelineActivities, setTimelineActivities] = useState<any[]>([
    {
      id: '1',
      type: 'UPDATE' as const,
      title: 'Project update created',
      description: 'Kitchen electrical progress update posted',
      timestamp: '2024-01-15T10:00:00Z',
      author: availableUsers[0] || { id: 'user1', name: 'Project Manager', email: 'pm@example.com' },
      metadata: {
        updateId: projectUpdates[0]?.id || '1',
        priority: 'HIGH' as const,
        tags: ['electrical', 'kitchen', 'progress']
      },
      isImportant: true
    },
    {
      id: '2',
      type: 'PHOTO' as const,
      title: 'Photos uploaded',
      description: 'Kitchen electrical outlet installation photos added',
      timestamp: '2024-01-15T10:15:00Z',
      author: availableUsers[0] || { id: 'user1', name: 'Project Manager', email: 'pm@example.com' },
      metadata: {
        photoId: photos[0]?.id || '1',
        photoUrl: photos[0]?.asset?.url || 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
        photoCount: photos.length,
        roomArea: 'Kitchen',
        tags: ['electrical', 'outlets', 'progress']
      }
    },
    {
      id: '3',
      type: 'TASK' as const,
      title: 'Task assigned',
      description: 'Kitchen island electrical installation task assigned',
      timestamp: '2024-01-15T10:30:00Z',
      author: availableUsers[0] || { id: 'user1', name: 'Project Manager', email: 'pm@example.com' },
      metadata: {
        taskId: tasks[0]?.id || '1',
        taskTitle: tasks[0]?.title || 'Install kitchen island electrical',
        assigneeId: tasks[0]?.assignee?.id || 'user2',
        assigneeName: tasks[0]?.assignee?.name || 'Electrician',
        priority: 'HIGH' as const,
        progress: 75
      }
    },
    {
      id: '4',
      type: 'MESSAGE' as const,
      title: 'Team discussion',
      description: 'Team members discussing electrical installation progress',
      timestamp: '2024-01-15T11:00:00Z',
      author: availableUsers[1] || { id: 'user2', name: 'Electrician', email: 'electrician@example.com' },
      metadata: {
        messageId: '2',
        messageContent: 'Thanks! The GFCI outlets are all tested and working properly.'
      }
    },
    {
      id: '5',
      type: 'APPROVAL' as const,
      title: 'Work approved',
      description: 'Kitchen electrical work approved for next phase',
      timestamp: '2024-01-15T12:00:00Z',
      author: project.client || { id: 'client1', name: 'Client', email: 'client@example.com' },
      metadata: {
        priority: 'HIGH' as const,
        tags: ['approval', 'electrical', 'kitchen']
      },
      isImportant: true
    }
  ])

  // Chat handlers
  const handleSendMessage = (content: string, parentId?: string, attachments?: any[]) => {
    const newMessage = {
      id: `msg_${Date.now()}`,
      content,
      authorId: availableUsers[0]?.id || 'current-user',
      author: availableUsers[0] || { id: 'current-user', name: 'Current User', email: 'user@example.com' },
      messageType: 'MESSAGE' as const,
      priority: 'NORMAL' as const,
      parentMessageId: parentId,
      mentions: [],
      attachments: attachments || [],
      reactions: [],
      readBy: [{ userId: availableUsers[0]?.id || 'current-user', userName: availableUsers[0]?.name || 'User', readAt: new Date().toISOString() }],
      isUrgent: false,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, newMessage])
    
    // Add to timeline
    const timelineActivity = {
      id: `activity_${Date.now()}`,
      type: 'MESSAGE' as const,
      title: 'New message',
      description: content.length > 50 ? content.substring(0, 50) + '...' : content,
      timestamp: new Date().toISOString(),
      author: newMessage.author,
      metadata: {
        messageId: newMessage.id,
        messageContent: content
      }
    }
    setTimelineActivities(prev => [timelineActivity, ...prev])
    
    console.log('Message sent:', newMessage)
  }

  const handleEditMessage = (messageId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content, isEdited: true, updatedAt: new Date().toISOString() }
        : msg
    ))
    console.log('Message edited:', messageId, content)
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
    console.log('Message deleted:', messageId)
  }

  const handleReactToMessage = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions.find(r => r.emoji === emoji)
        const currentUser = { id: availableUsers[0]?.id || 'current-user', name: availableUsers[0]?.name || 'User' }
        
        if (existingReaction) {
          const hasReacted = existingReaction.users.some(u => u.id === currentUser.id)
          if (hasReacted) {
            existingReaction.users = existingReaction.users.filter(u => u.id !== currentUser.id)
            if (existingReaction.users.length === 0) {
              msg.reactions = msg.reactions.filter(r => r.emoji !== emoji)
            }
          } else {
            existingReaction.users.push(currentUser)
          }
        } else {
          msg.reactions.push({
            emoji,
            users: [currentUser]
          })
        }
      }
      return msg
    }))
    console.log('Message reaction:', messageId, emoji)
  }

  const handleUploadFile = async (files: File[]) => {
    // Mock file upload - replace with actual implementation
    const uploadedFiles = files.map((file, index) => ({
      id: `file_${Date.now()}_${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      size: file.size
    }))
    console.log('Files uploaded:', uploadedFiles)
    return uploadedFiles
  }

  // Timeline handlers
  const handleActivityClick = (activity: any) => {
    console.log('Activity clicked:', activity)
  }

  const handleMilestoneClick = (milestone: any) => {
    console.log('Milestone clicked:', milestone)
  }

  const handleExportTimeline = () => {
    console.log('Exporting timeline...')
  }

  // Photo handlers
  const handlePhotoSelect = (photo: any) => {
    console.log('Photo selected:', photo)
  }

  const handlePhotoUpdate = (photoId: string, updates: any) => {
    console.log('Photo update:', photoId, updates)
    // In production, this would call the API to update the photo
  }

  const handlePhotoDelete = (photoId: string) => {
    console.log('Photo delete:', photoId)
    // In production, this would call the API to delete the photo
  }

  // Task handlers
  const handleTaskCreate = (task: any) => {
    console.log('Task create:', task)
    // In production, this would call the API to create the task
  }

  const handleTaskUpdate = (taskId: string, updates: any) => {
    console.log('Task update:', taskId, updates)
    // In production, this would call the API to update the task
  }

  const handleTaskDelete = (taskId: string) => {
    console.log('Task delete:', taskId)
    // In production, this would call the API to delete the task
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-8">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-8">
        {/* Overview Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Updates */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
              <div className="space-y-4">
                {projectUpdates.map((update: any) => (
                  <div key={update.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{update.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{update.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>by {update.author.name}</span>
                        <span>{new Date(update.createdAt).toLocaleDateString()}</span>
                        <span>{update._count.photos} photos</span>
                        <span>{update._count.tasks} tasks</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Project Status</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Photos</span>
                  <span className="font-semibold">{photos.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Tasks</span>
                  <span className="font-semibold">{tasks.filter(t => t.status !== 'DONE').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Completed Tasks</span>
                  <span className="font-semibold">{tasks.filter(t => t.status === 'DONE').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Team Members</span>
                  <span className="font-semibold">{availableUsers.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Contractors</span>
                  <span className="font-semibold">{availableContractors.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="photos">
        <PhotoGallery
          projectId={projectId}
          updateId={projectUpdates[0]?.id || ''}
          photos={photos}
          onPhotoSelect={handlePhotoSelect}
          onPhotoUpdate={handlePhotoUpdate}
          onPhotoDelete={handlePhotoDelete}
          canEdit={true}
          showBeforeAfter={true}
        />
      </TabsContent>

      <TabsContent value="tasks">
        <TaskBoard
          projectId={projectId}
          tasks={tasks}
          onTaskCreate={handleTaskCreate}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          canEdit={true}
          showDependencies={true}
          availableUsers={availableUsers}
          availableContractors={availableContractors}
        />
      </TabsContent>

      <TabsContent value="messages">
        <ChatInterface
          projectId={projectId}
          messages={messages}
          currentUser={availableUsers[0] || { id: 'current-user', name: 'Current User', email: 'user@example.com' }}
          participants={availableUsers}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReactToMessage={handleReactToMessage}
          onUploadFile={handleUploadFile}
          canEdit={true}
          showParticipants={true}
          height="h-[600px]"
        />
      </TabsContent>

      <TabsContent value="timeline">
        <Timeline
          activities={timelineActivities}
          currentUser={availableUsers[0] || { id: 'current-user', name: 'Current User', email: 'user@example.com' }}
          onActivityClick={handleActivityClick}
          onMilestoneClick={handleMilestoneClick}
          onExportTimeline={handleExportTimeline}
          showFilters={true}
          showMilestones={true}
          maxHeight="max-h-[600px]"
        />
      </TabsContent>
    </Tabs>
  )
}