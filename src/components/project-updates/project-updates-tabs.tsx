'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, FileImage, CheckSquare, MessageCircle, Activity } from 'lucide-react'
import PhotoGallery from './photo-gallery'
import TaskBoard from './task-board'
import ChatInterface from './chat-interface'
import Timeline from './timeline'
import EmptyState from './empty-state'
import { useTasks } from '@/hooks/useTasks'
import { useToast, ToastContainer } from '@/components/ui/toast'

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
  tasks: initialTasks,
  availableUsers,
  availableContractors
}: ProjectUpdatesTabsProps) {
  const { toasts, success, error: showError, dismissToast } = useToast()
  const { tasks, isLoading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask } = useTasks(projectId)
  const [messages, setMessages] = useState<any[]>([])
  const [timelineActivities, setTimelineActivities] = useState<any[]>([])

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

  }

  const handleEditMessage = (messageId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content, isEdited: true, updatedAt: new Date().toISOString() }
        : msg
    ))
    
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
    
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
    
    return uploadedFiles
  }

  // Timeline handlers
  const handleActivityClick = (activity: any) => {
    
  }

  const handleMilestoneClick = (milestone: any) => {
    
  }

  const handleExportTimeline = () => {
    
  }

  // Photo handlers
  const handlePhotoSelect = (photo: any) => {
    
  }

  const handlePhotoUpdate = (photoId: string, updates: any) => {
    
    // In production, this would call the API to update the photo
  }

  const handlePhotoDelete = (photoId: string) => {
    
    // In production, this would call the API to delete the photo
  }

  // Task handlers
  const handleTaskCreate = async (task: any) => {
    try {
      await createTask(task)
      success('Task Created', `Task "${task.title}" created successfully`)
    } catch (error) {
      showError('Create Failed', error instanceof Error ? error.message : 'Failed to create task')
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      await updateTask(taskId, updates)
      // Success toast handled in TaskBoard for drag and drop
    } catch (error) {
      showError('Update Failed', error instanceof Error ? error.message : 'Failed to update task')
      throw error // Re-throw so TaskBoard can handle UI reversion
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      // Success toast is handled by TaskBoard
    } catch (error) {
      showError('Delete Failed', error instanceof Error ? error.message : 'Failed to delete task')
      throw error // Re-throw so TaskBoard can handle UI updates
    }
  }

  return (
    <>
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
                {projectUpdates.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No updates yet"
                    description="Start documenting your project progress by creating your first update."
                    actionLabel="Add Update"
                    onAction={() => console.log('Add update clicked')}
                    variant="subtle"
                  />
                ) : (
                  projectUpdates.map((update: any) => (
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
                  ))
                )}
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
        {photos.length === 0 ? (
          <EmptyState
            icon={FileImage}
            title="No photos yet"
            description="Upload photos to document your project progress and share updates with your team."
            actionLabel="Upload Photos"
            onAction={() => console.log('Upload photos clicked')}
          />
        ) : (
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
        )}
      </TabsContent>

      <TabsContent value="tasks">
        {tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Create tasks to organize work, assign team members, and track progress on your project."
            actionLabel="Create Task"
            onAction={() => {
              // TaskBoard will handle the create dialog
              console.log('Create task from empty state - TaskBoard should handle this')
            }}
          />
        ) : tasksLoading ? (
          <div className="space-y-6">
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, j) => (
                      <div key={j} className="h-20 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )}
      </TabsContent>

      <TabsContent value="messages">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No messages yet"
            description="Start a conversation with your team to discuss project details and coordinate work."
            actionLabel="Start Conversation"
            onAction={() => console.log('Start conversation clicked')}
          />
        ) : (
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
        )}
      </TabsContent>

      <TabsContent value="timeline">
        {timelineActivities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No timeline activities yet"
            description="Project activities will appear here as you create updates, upload photos, and manage tasks."
            variant="subtle"
          />
        ) : (
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
        )}
      </TabsContent>
    </Tabs>
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}