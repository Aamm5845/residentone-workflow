'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
// import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, FileImage, CheckSquare, MessageCircle, Activity, Plus, Eye, Edit, Tag, Trash2, Loader2, X, Megaphone, AlertTriangle, FileText, Milestone, ClipboardCheck, Users, MoreHorizontal, Pencil, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PhotoGallery from './photo-gallery'
import TaskBoard from './task-board'
import ChatInterface from './chat-interface'
import Timeline from './timeline'
import EmptyState from './empty-state'
import CreateUpdateDialog from './create-update-dialog'
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
  const [createUpdateDialogOpen, setCreateUpdateDialogOpen] = useState(false)
  const [viewUpdateDialogOpen, setViewUpdateDialogOpen] = useState(false)
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null)

  // Helper to get icon based on type
  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      'GENERAL': <Megaphone className="w-5 h-5" />,
      'PHOTO': <FileImage className="w-5 h-5" />,
      'TASK': <CheckSquare className="w-5 h-5" />,
      'DOCUMENT': <FileText className="w-5 h-5" />,
      'COMMUNICATION': <MessageCircle className="w-5 h-5" />,
      'MILESTONE': <Milestone className="w-5 h-5" />,
      'INSPECTION': <ClipboardCheck className="w-5 h-5" />,
      'ISSUE': <AlertTriangle className="w-5 h-5" />
    }
    return icons[type] || <Activity className="w-5 h-5" />
  }

  // Helper to get icon background color based on type
  const getTypeIconStyle = (type: string) => {
    const styles: Record<string, string> = {
      'GENERAL': 'bg-gradient-to-br from-slate-500 to-slate-600 text-white',
      'PHOTO': 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
      'TASK': 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
      'DOCUMENT': 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
      'COMMUNICATION': 'bg-gradient-to-br from-violet-500 to-violet-600 text-white',
      'MILESTONE': 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
      'INSPECTION': 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white',
      'ISSUE': 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
    }
    return styles[type] || 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'
  }

  // Helper to format type label (Title Case)
  const formatTypeLabel = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase()
  }

  // Helper to format priority label
  const formatPriorityLabel = (priority: string) => {
    return priority.charAt(0) + priority.slice(1).toLowerCase()
  }

  // Helper to get badge color based on type
  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      'GENERAL': 'bg-slate-100 text-slate-700 border-slate-200',
      'PHOTO': 'bg-blue-50 text-blue-700 border-blue-200',
      'TASK': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'DOCUMENT': 'bg-amber-50 text-amber-700 border-amber-200',
      'COMMUNICATION': 'bg-violet-50 text-violet-700 border-violet-200',
      'MILESTONE': 'bg-orange-50 text-orange-700 border-orange-200',
      'INSPECTION': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'ISSUE': 'bg-rose-50 text-rose-700 border-rose-200'
    }
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getPriorityBadgeColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-gray-50 text-gray-600 border-gray-200',
      'NORMAL': 'bg-blue-50 text-blue-600 border-blue-200',
      'MEDIUM': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'HIGH': 'bg-orange-50 text-orange-700 border-orange-200',
      'URGENT': 'bg-red-50 text-red-700 border-red-200'
    }
    return colors[priority] || 'bg-gray-50 text-gray-600 border-gray-200'
  }

  const handleViewUpdate = (update: any) => {
    setSelectedUpdate(update)
    setViewUpdateDialogOpen(true)
  }

  // Edit update state
  const [editUpdateDialogOpen, setEditUpdateDialogOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    type: 'GENERAL',
    priority: 'MEDIUM',
    roomId: ''
  })
  const [isUpdating, setIsUpdating] = useState(false)

  const handleEditUpdate = (update: any) => {
    setEditingUpdate(update)
    setEditFormData({
      title: update.title || '',
      description: update.description || '',
      type: update.type || 'GENERAL',
      priority: update.priority || 'MEDIUM',
      roomId: update.roomId || ''
    })
    setEditUpdateDialogOpen(true)
  }

  const handleSaveUpdate = async () => {
    if (!editingUpdate) return
    
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates/${editingUpdate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update')
      }
      
      setEditUpdateDialogOpen(false)
      setEditingUpdate(null)
      success('Update Saved', 'The update has been saved successfully')
      router.refresh()
    } catch (err) {
      showError('Save Failed', err instanceof Error ? err.message : 'Failed to save update')
    } finally {
      setIsUpdating(false)
    }
  }

  const [isDeletingUpdate, setIsDeletingUpdate] = useState(false)
  const router = useRouter()

  const handleDeleteUpdate = async (updateId: string) => {
    if (!confirm('Are you sure you want to delete this update? This action cannot be undone.')) {
      return
    }
    
    setIsDeletingUpdate(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates/${updateId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete update')
      }
      
      setViewUpdateDialogOpen(false)
      setSelectedUpdate(null)
      success('Update Deleted', 'The update has been deleted successfully')
      router.refresh()
    } catch (err) {
      showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete update')
    } finally {
      setIsDeletingUpdate(false)
    }
  }

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
            <div className="bg-gradient-to-b from-white to-gray-50/50 rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <Megaphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Recent Updates</h3>
                    <p className="text-xs text-gray-500">Team announcements & progress</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setCreateUpdateDialogOpen(true)} 
                  size="sm"
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm border-0"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Update
                </Button>
              </div>
              <div className="space-y-3">
                {/* Filter out internal updates (like photo uploads) - only show team communication posts */}
                {projectUpdates.filter((u: any) => !u.isInternal).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4">
                      <Megaphone className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-900 mb-1">No updates yet</h4>
                    <p className="text-sm text-gray-500 text-center mb-4 max-w-xs">
                      Post updates to keep your team informed about project progress and milestones.
                    </p>
                    <Button 
                      onClick={() => setCreateUpdateDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create First Update
                    </Button>
                  </div>
                ) : (
                  projectUpdates.filter((u: any) => !u.isInternal).map((update: any) => (
                    <div 
                      key={update.id} 
                      className="group relative flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer" 
                      onClick={() => handleViewUpdate(update)}
                    >
                      {/* Type Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${getTypeIconStyle(update.type)}`}>
                        {getTypeIcon(update.type)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 min-h-[72px] flex flex-col">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900 text-[15px] leading-tight">
                                {update.title || `${formatTypeLabel(update.type)} Update`}
                              </h4>
                              <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-5 rounded border ${getTypeBadgeColor(update.type)}`}>
                                {formatTypeLabel(update.type)}
                              </Badge>
                              {update.priority !== 'MEDIUM' && update.priority !== 'NORMAL' && (
                                <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-5 rounded border ${getPriorityBadgeColor(update.priority)}`}>
                                  {formatPriorityLabel(update.priority)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions - visible on hover */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditUpdate(update)
                              }}
                              title="Edit update"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteUpdate(update.id)
                              }}
                              title="Delete update"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Description - fixed height area */}
                        <div className="flex-1 mt-1">
                          {update.description ? (
                            <p className="text-sm text-gray-600 line-clamp-1 leading-relaxed">{update.description}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">No description</p>
                          )}
                        </div>
                        
                        {/* Footer */}
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            {update.author?.image ? (
                              <img 
                                src={update.author.image} 
                                alt={update.author.name || 'User'}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-medium text-white">
                                {(update.author?.name || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-gray-700">{update.author?.name || 'Unknown'}</span>
                          </div>
                          <span className="text-gray-300">•</span>
                          <span>{new Date(update.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          {/* Show room if selected */}
                          {update.roomId && project?.rooms && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                <Home className="w-3 h-3" />
                                {project.rooms.find((r: any) => r.id === update.roomId)?.name || 'Room'}
                              </span>
                            </>
                          )}
                          {/* Show photo and task counts */}
                          {(update._count?.photos > 0 || update._count?.tasks > 0) && (
                            <>
                              <span className="text-gray-300">•</span>
                              <div className="flex items-center gap-2 text-gray-500">
                                {update._count?.photos > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <FileImage className="w-3 h-3" />
                                    {update._count.photos}
                                  </span>
                                )}
                                {update._count?.tasks > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <CheckSquare className="w-3 h-3" />
                                    {update._count.tasks}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
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
                  <span className="font-semibold text-purple-600">{photos.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Tasks</span>
                  <span className="font-semibold text-blue-600">{tasks.filter(t => t.status !== 'DONE').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Completed Tasks</span>
                  <span className="font-semibold text-green-600">{tasks.filter(t => t.status === 'DONE').length}</span>
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

            {/* Recent Photos */}
            {photos.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Photos</h3>
                  <Button variant="ghost" size="sm" onClick={() => {
                    // Switch to photos tab
                    const photosTab = document.querySelector('[value="photos"]') as HTMLButtonElement
                    photosTab?.click()
                  }}>
                    <Eye className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {photos.slice(0, 4).map((photo: any) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer">
                      <img
                        src={photo.asset.url}
                        alt={photo.asset.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs text-white truncate">{photo.caption || photo.asset.title}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
    
    <CreateUpdateDialog
      open={createUpdateDialogOpen}
      onOpenChange={setCreateUpdateDialogOpen}
      projectId={projectId}
      rooms={project?.rooms || []}
      onSuccess={(update) => {
        success('Update Created', `Update "${update.title || 'New update'}" created successfully`)
      }}
    />

    {/* View Update Dialog */}
    <Dialog open={viewUpdateDialogOpen} onOpenChange={setViewUpdateDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedUpdate?.title || `${selectedUpdate?.type} Update`}
          </DialogTitle>
          <DialogDescription>
            Update details and information
          </DialogDescription>
        </DialogHeader>
        
        {selectedUpdate && (
          <div className="space-y-4 px-4">
            {/* Tags - only show type and priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getTypeBadgeColor(selectedUpdate.type)}>
                {selectedUpdate.type}
              </Badge>
              {selectedUpdate.priority && selectedUpdate.priority !== 'MEDIUM' && (
                <Badge className={getPriorityBadgeColor(selectedUpdate.priority)}>
                  {selectedUpdate.priority}
                </Badge>
              )}
            </div>

            {/* Description */}
            {selectedUpdate.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                <p className="text-sm text-gray-600">{selectedUpdate.description}</p>
              </div>
            )}

            {/* Location */}
            {selectedUpdate.location && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Location</h4>
                <p className="text-sm text-gray-600">{selectedUpdate.location}</p>
              </div>
            )}

            {/* Photos section */}
            {selectedUpdate.photos && selectedUpdate.photos.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Photos ({selectedUpdate.photos.length})</h4>
                <div className="grid grid-cols-3 gap-2">
                  {selectedUpdate.photos.map((photo: any) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                      <img
                        src={photo.asset?.url || `/api/assets/${photo.assetId}/file`}
                        alt={photo.caption || photo.asset?.title || 'Photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = '/placeholder-image.svg'
                        }}
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                          <p className="text-xs text-white truncate">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Created By</h4>
                <p className="text-sm text-gray-600">{selectedUpdate.author?.name || 'Unknown'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Created At</h4>
                <p className="text-sm text-gray-600">
                  {new Date(selectedUpdate.createdAt).toLocaleDateString()} at {new Date(selectedUpdate.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {selectedUpdate.dueDate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Due Date</h4>
                  <p className="text-sm text-gray-600">{new Date(selectedUpdate.dueDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Stats</h4>
                <p className="text-sm text-gray-600">
                  {selectedUpdate._count?.photos || 0} photos, {selectedUpdate._count?.tasks || 0} tasks
                </p>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Edit Update Dialog */}
    <Dialog open={editUpdateDialogOpen} onOpenChange={setEditUpdateDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Update</DialogTitle>
          <DialogDescription>
            Make changes to this update.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 px-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editFormData.type}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="PHOTO">Photo</SelectItem>
                  <SelectItem value="TASK">Task</SelectItem>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                  <SelectItem value="MILESTONE">Milestone</SelectItem>
                  <SelectItem value="ISSUE">Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={editFormData.priority}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={editFormData.title}
              onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Update title"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={editFormData.description}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Update description..."
              rows={4}
            />
          </div>

          {project?.rooms && project.rooms.length > 0 && (
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={editFormData.roomId || 'none'}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, roomId: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific room</SelectItem>
                  {project.rooms.map((room: any) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="px-4">
          <Button variant="outline" onClick={() => setEditUpdateDialogOpen(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSaveUpdate} disabled={isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
