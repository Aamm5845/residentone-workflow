'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
// import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, FileImage, CheckSquare, MessageCircle, Activity, Plus, Eye, Edit, Tag, Trash2, Loader2, X, Megaphone, AlertTriangle, FileText, Milestone, ClipboardCheck, Users, MoreHorizontal, Pencil, Home, Play, Video } from 'lucide-react'
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
import SiteSurveyDialog from './site-survey/SiteSurveyDialog'
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
  openIssuesCount: number
}

export default function ProjectUpdatesTabs({
  projectId,
  project,
  projectUpdates,
  photos,
  tasks: initialTasks,
  availableUsers,
  availableContractors,
  openIssuesCount
}: ProjectUpdatesTabsProps) {
  const { toasts, success, error: showError, dismissToast } = useToast()
  const { tasks, isLoading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask } = useTasks(projectId)
  const [messages, setMessages] = useState<any[]>([])
  const [timelineActivities, setTimelineActivities] = useState<any[]>([])
  const [createUpdateDialogOpen, setCreateUpdateDialogOpen] = useState(false)
  const [viewUpdateDialogOpen, setViewUpdateDialogOpen] = useState(false)
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null)
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false)

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
      'GENERAL': 'bg-gray-100 text-gray-600',
      'PHOTO': 'bg-blue-50 text-blue-600',
      'TASK': 'bg-green-50 text-green-600',
      'DOCUMENT': 'bg-amber-50 text-amber-600',
      'COMMUNICATION': 'bg-purple-50 text-purple-600',
      'MILESTONE': 'bg-orange-50 text-orange-600',
      'INSPECTION': 'bg-cyan-50 text-cyan-600',
      'ISSUE': 'bg-red-50 text-red-600'
    }
    return colors[type] || 'bg-gray-100 text-gray-600'
  }

  const getPriorityBadgeColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-gray-100 text-gray-500',
      'NORMAL': 'bg-gray-100 text-gray-600',
      'MEDIUM': 'bg-yellow-50 text-yellow-600',
      'HIGH': 'bg-orange-50 text-orange-600',
      'URGENT': 'bg-red-50 text-red-600'
    }
    return colors[priority] || 'bg-gray-100 text-gray-500'
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

  const handlePhotoDelete = async (photoId: string) => {
    // Find the photo to get its updateId
    const photo = photos.find((p: any) => p.id === photoId)
    if (!photo) {
      showError('Delete Failed', 'Photo not found')
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/updates/${photo.updateId}/photos/${photoId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete photo')
      }

      success('Photo Deleted', 'Photo has been removed successfully')
      // Refresh the page to reflect the deletion
      router.refresh()
    } catch (error) {
      console.error('Error deleting photo:', error)
      showError('Delete Failed', error instanceof Error ? error.message : 'Failed to delete photo')
    }
  }

  const handleBulkPhotoDelete = async (photoIds: string[]) => {
    let successCount = 0
    let failCount = 0
    
    for (const photoId of photoIds) {
      const photo = photos.find((p: any) => p.id === photoId)
      if (!photo) {
        failCount++
        continue
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/updates/${photo.updateId}/photos/${photoId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error('Error deleting photo:', error)
        failCount++
      }
    }

    if (successCount > 0) {
      success('Photos Deleted', `${successCount} photo${successCount !== 1 ? 's' : ''} deleted successfully${failCount > 0 ? `, ${failCount} failed` : ''}`)
      router.refresh()
    } else {
      showError('Delete Failed', 'Failed to delete selected photos')
    }
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
        <TabsTrigger value="photos">
          {(() => {
            const photoCount = photos.filter((p: any) => !p.asset?.mimeType?.startsWith('video/')).length
            const videoCount = photos.filter((p: any) => p.asset?.mimeType?.startsWith('video/')).length
            if (photoCount > 0 && videoCount > 0) return `Photos (${photoCount}) & Videos (${videoCount})`
            if (videoCount > 0) return `Videos (${videoCount})`
            return `Photos (${photoCount})`
          })()}
        </TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Overview Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Updates */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Megaphone className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Recent Updates</h3>
                    <p className="text-sm text-gray-500">Team announcements & progress</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setCreateUpdateDialogOpen(true)} 
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Update
                </Button>
              </div>
              <div className="space-y-2">
                {/* Filter out internal updates (like photo uploads) - only show team communication posts */}
                {projectUpdates.filter((u: any) => !u.isInternal).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <p className="text-gray-500 mb-3">No updates yet</p>
                    <Button 
                      onClick={() => setCreateUpdateDialogOpen(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create First Update
                    </Button>
                  </div>
                ) : (
                  projectUpdates.filter((u: any) => !u.isInternal).map((update: any) => (
                    <div 
                      key={update.id} 
                      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-0" 
                      onClick={() => handleViewUpdate(update)}
                    >
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-gray-900">
                                {update.title || `${formatTypeLabel(update.type)} Update`}
                              </h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor(update.type)}`}>
                                {formatTypeLabel(update.type)}
                              </span>
                              {update.priority !== 'MEDIUM' && update.priority !== 'NORMAL' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadgeColor(update.priority)}`}>
                                  {formatPriorityLabel(update.priority)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions - visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditUpdate(update)
                              }}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteUpdate(update.id)
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Description */}
                        {update.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{update.description}</p>
                        )}
                        
                        {/* Footer */}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <span>{update.author?.name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{new Date(update.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          {update.roomId && project?.rooms && (
                            <>
                              <span>•</span>
                              <span>{project.rooms.find((r: any) => r.id === update.roomId)?.name || 'Room'}</span>
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
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Project Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                      <FileImage className="w-4 h-4 text-violet-500" />
                    </div>
                    <span className="text-gray-600">
                      {(() => {
                        const videoCount = photos.filter((p: any) => p.asset?.mimeType?.startsWith('video/')).length
                        return videoCount > 0 ? 'Media' : 'Photos'
                      })()}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {(() => {
                      const photoCount = photos.filter((p: any) => !p.asset?.mimeType?.startsWith('video/')).length
                      const videoCount = photos.filter((p: any) => p.asset?.mimeType?.startsWith('video/')).length
                      if (photoCount > 0 && videoCount > 0) return `${photoCount}+${videoCount}`
                      return photos.length
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-gray-600">Active Tasks</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{tasks.filter(t => t.status !== 'DONE').length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-gray-600">Completed</span>
                  </div>
                  <span className="text-lg font-semibold text-emerald-600">{tasks.filter(t => t.status === 'DONE').length}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-gray-600">Open Issues</span>
                  </div>
                  <span className="text-lg font-semibold text-orange-600">{openIssuesCount}</span>
                </div>
              </div>
            </div>

            {/* Recent Media */}
            {photos.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <FileImage className="w-4 h-4 text-cyan-600" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-700">
                      {(() => {
                        const hasVideos = photos.some((p: any) => p.asset?.mimeType?.startsWith('video/'))
                        return hasVideos ? 'Recent Media' : 'Recent Photos'
                      })()}
                    </h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-500 hover:text-gray-900 -mr-2"
                    onClick={() => {
                      const photosTab = document.querySelector('[value="photos"]') as HTMLButtonElement
                      photosTab?.click()
                    }}
                  >
                    View All
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {photos.slice(0, 4).map((photo: any) => {
                    const isVideo = photo.asset?.mimeType?.startsWith('video/')
                    return (
                      <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer">
                        {isVideo ? (
                          <>
                            {/* Video thumbnail - use video element with poster or first frame */}
                            <video
                              src={photo.asset.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            {/* Play icon overlay for videos */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-purple-600/80 transition-colors duration-200">
                                <Play className="w-6 h-6 text-white ml-1" fill="white" />
                              </div>
                            </div>
                            {/* Video badge */}
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded flex items-center gap-1">
                                <Video className="w-2.5 h-2.5" />
                                Video
                              </span>
                            </div>
                          </>
                        ) : (
                          <img
                            src={photo.asset.url}
                            alt={photo.asset.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end pointer-events-none">
                          <p className="text-xs text-white p-2 truncate w-full">{photo.caption || photo.asset.title}</p>
                        </div>
                      </div>
                    )
                  })}
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
            description="Start a site survey to capture and organize photos from the job site."
            actionLabel="Start Survey"
            onAction={() => setSurveyDialogOpen(true)}
          />
        ) : (
          <PhotoGallery
            projectId={projectId}
            updateId={projectUpdates[0]?.id || ''}
            photos={photos}
            onPhotoSelect={handlePhotoSelect}
            onPhotoUpdate={handlePhotoUpdate}
            onPhotoDelete={handlePhotoDelete}
            onBulkDelete={handleBulkPhotoDelete}
            canEdit={true}
            showBeforeAfter={true}
          />
        )}
      </TabsContent>

      <TabsContent value="tasks">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
            <CheckSquare className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Tasks Coming Soon</h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            Task management for project updates is currently in development. Soon you'll be able to create, assign, and track tasks directly from updates.
          </p>
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
            In Progress
          </Badge>
        </div>
      </TabsContent>

      <TabsContent value="messages">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <MessageCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Messages Coming Soon</h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            Team messaging for project updates is currently in development. Soon you'll be able to discuss updates and coordinate with your team in real-time.
          </p>
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
            In Progress
          </Badge>
        </div>
      </TabsContent>

      <TabsContent value="timeline">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
            <Activity className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Timeline Coming Soon</h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            Project timeline visualization is currently in development. Soon you'll see a complete history of all project activities, milestones, and updates.
          </p>
          <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
            In Progress
          </Badge>
        </div>
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

    {/* Site Survey Dialog */}
    <SiteSurveyDialog
      open={surveyDialogOpen}
      onOpenChange={setSurveyDialogOpen}
      projectId={projectId}
      projectName={project?.name || 'Project'}
      rooms={project?.rooms || []}
      onSuccess={() => {
        success('Survey Complete', 'Photos uploaded successfully')
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
