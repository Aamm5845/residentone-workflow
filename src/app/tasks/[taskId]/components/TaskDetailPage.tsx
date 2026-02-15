'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast, ToastContainer } from '@/components/ui/toast'
import { toSafeSelectValue, fromSafeSelectValue, NONE_UNASSIGNED } from '@/lib/selectSafe'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Loader2,
  Calendar,
  User,
  Flag,
  FolderOpen,
  DoorOpen,
  Layers,
  Clock,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import type {
  TaskData,
  TaskUser,
  TaskStatus,
  TaskPriority,
  SubtaskData,
  CommentData,
  AttachmentData,
} from '@/components/tasks/types'
import { statusConfig, priorityConfig } from '@/components/tasks/types'
import { TaskSubtaskList } from '@/components/tasks/TaskSubtaskList'
import { TaskComments } from '@/components/tasks/TaskComments'
import { TaskAttachments } from '@/components/tasks/TaskAttachments'

interface TaskDetailPageProps {
  taskId: string
  availableUsers: TaskUser[]
  availableRooms?: { id: string; name: string | null; type: string }[]
  currentUserId: string
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email[0]?.toUpperCase() || '?'
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TaskDetailPage({
  taskId,
  availableUsers,
  availableRooms,
  currentUserId,
}: TaskDetailPageProps) {
  const router = useRouter()
  const { toasts, dismissToast, success, error: showError } = useToast()

  // Full task data fetched from API
  const [taskDetail, setTaskDetail] = useState<TaskData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState('')

  const titleInputRef = useRef<HTMLInputElement>(null)

  const task = taskDetail

  // Fetch full task details on mount
  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/tasks/${taskId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch task')
        return res.json()
      })
      .then((data) => {
        setTaskDetail(data.task)
      })
      .catch(() => {
        // Task fetch failed - redirect back
        router.push('/tasks')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [taskId, router])

  // Reset editing states when task changes
  useEffect(() => {
    setIsEditingTitle(false)
    setIsEditingDescription(false)
  }, [task?.id])

  const patchTask = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!task) return

      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update task')
        }

        const data = await response.json()
        // Merge the updated task with existing detail data (subtasks, comments, etc.)
        const mergedTask = {
          ...taskDetail,
          ...data.task,
          subtasks: taskDetail?.subtasks || [],
          comments: taskDetail?.comments || [],
          attachments: taskDetail?.attachments || [],
        } as TaskData
        setTaskDetail(mergedTask)
      } catch (err) {
        showError('Error', err instanceof Error ? err.message : 'Failed to update task')
      }
    },
    [task, taskDetail, showError]
  )

  // --- Field update handlers ---

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task || task.status === newStatus) return
    setTaskDetail((prev) => (prev ? { ...prev, status: newStatus } : null))
    patchTask({ status: newStatus })
  }

  const handlePriorityChange = (newPriority: TaskPriority) => {
    if (!task || task.priority === newPriority) return
    setTaskDetail((prev) => (prev ? { ...prev, priority: newPriority } : null))
    patchTask({ priority: newPriority })
  }

  const handleAssigneeChange = (userId: string) => {
    const resolvedId = fromSafeSelectValue(userId) || null
    if (!task) return
    setTaskDetail((prev) => {
      if (!prev) return null
      const assignee = resolvedId
        ? availableUsers.find((u) => u.id === resolvedId) || null
        : null
      return { ...prev, assignedToId: resolvedId, assignedTo: assignee as TaskUser | null }
    })
    patchTask({ assignedToId: resolvedId })
  }

  const handleStartDateChange = (value: string) => {
    if (!task) return
    setTaskDetail((prev) => (prev ? { ...prev, startDate: value || null } : null))
    patchTask({ startDate: value || null })
  }

  const handleDueDateChange = (value: string) => {
    if (!task) return
    setTaskDetail((prev) => (prev ? { ...prev, dueDate: value || null } : null))
    patchTask({ dueDate: value || null })
  }

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim()
    if (!trimmed || !task || trimmed === task.title) {
      setIsEditingTitle(false)
      return
    }
    setTaskDetail((prev) => (prev ? { ...prev, title: trimmed } : null))
    patchTask({ title: trimmed })
    setIsEditingTitle(false)
  }

  const handleSaveDescription = () => {
    if (!task) return
    const trimmed = editDescription.trim()
    if (trimmed === (task.description || '')) {
      setIsEditingDescription(false)
      return
    }
    setTaskDetail((prev) => (prev ? { ...prev, description: trimmed || null } : null))
    patchTask({ description: trimmed || null })
    setIsEditingDescription(false)
  }

  const handleDelete = async () => {
    if (!task) return
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete task')
      }

      success('Task deleted', 'The task has been permanently deleted.')
      router.push('/tasks')
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  // --- Sub-component change handlers ---

  const handleSubtasksChange = (subtasks: SubtaskData[]) => {
    setTaskDetail((prev) => (prev ? { ...prev, subtasks } : null))
  }

  const handleCommentsChange = (comments: CommentData[]) => {
    setTaskDetail((prev) => (prev ? { ...prev, comments } : null))
  }

  const handleAttachmentsChange = (attachments: AttachmentData[]) => {
    setTaskDetail((prev) => (prev ? { ...prev, attachments } : null))
  }

  const statusKeys = Object.keys(statusConfig) as TaskStatus[]

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Task not found
  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="outline" onClick={() => router.push('/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen">
        {/* Header bar */}
        <div className="border-b border-gray-200 bg-white">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <span className="text-sm text-gray-500">Task Details</span>
            </div>

            {/* Delete dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main content */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Main content (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title */}
              <div>
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') setIsEditingTitle(false)
                      }}
                      onBlur={handleSaveTitle}
                      className="text-xl font-semibold h-auto py-1.5"
                      autoFocus
                    />
                  </div>
                ) : (
                  <h1
                    className="text-xl font-semibold cursor-pointer hover:text-blue-600 transition-colors group"
                    onClick={() => {
                      setEditTitle(task.title)
                      setIsEditingTitle(true)
                    }}
                  >
                    {task.title}
                    <Pencil className="inline h-3.5 w-3.5 ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </h1>
                )}
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {statusKeys.map((key) => {
                  const config = statusConfig[key]
                  const isActive = task.status === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border',
                        isActive
                          ? `${config.color} border-current`
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isActive ? config.dotColor : 'bg-gray-300'
                        )}
                      />
                      {config.label}
                    </button>
                  )
                })}
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Description</h3>
                  {!isEditingDescription && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditDescription(task.description || '')
                        setIsEditingDescription(true)
                      }}
                      className="h-7 w-7"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {isEditingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Add a description..."
                      rows={4}
                      autoFocus
                      className="text-sm"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingDescription(false)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveDescription}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={cn(
                      'text-sm whitespace-pre-wrap',
                      task.description
                        ? 'text-gray-700'
                        : 'text-muted-foreground italic cursor-pointer hover:text-gray-500'
                    )}
                    onClick={() => {
                      if (!task.description) {
                        setEditDescription('')
                        setIsEditingDescription(true)
                      }
                    }}
                  >
                    {task.description || 'Click to add a description...'}
                  </p>
                )}
              </div>

              <Separator />

              {/* Subtasks */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-gray-900">Subtasks</h3>
                  {(taskDetail?.subtasks?.length || 0) > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {taskDetail?.subtasks?.filter((s) => s.completed).length || 0}/
                      {taskDetail?.subtasks?.length || 0} completed
                    </span>
                  )}
                </div>
                <TaskSubtaskList
                  taskId={task.id}
                  subtasks={taskDetail?.subtasks || []}
                  onSubtasksChange={handleSubtasksChange}
                />
              </div>

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                  {(taskDetail?.comments?.length || 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({taskDetail?.comments?.length || 0})
                    </span>
                  )}
                </div>
                <TaskComments
                  taskId={task.id}
                  comments={taskDetail?.comments || []}
                  currentUserId={currentUserId}
                  onCommentsChange={handleCommentsChange}
                />
              </div>

              <Separator />

              {/* Attachments */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
                  {(taskDetail?.attachments?.length || 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({taskDetail?.attachments?.length || 0})
                    </span>
                  )}
                </div>
                <TaskAttachments
                  taskId={task.id}
                  attachments={taskDetail?.attachments || []}
                  onAttachmentsChange={handleAttachmentsChange}
                />
              </div>
            </div>

            {/* Right column: Metadata sidebar (1/3) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 lg:sticky lg:top-24">
                <h3 className="text-sm font-semibold text-gray-900">Details</h3>

                {/* Assignee */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Assignee</span>
                  </div>
                  <Select
                    value={toSafeSelectValue(task.assignedToId)}
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <SelectValue>
                        {task.assignedTo ? (
                          <span className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={task.assignedTo.image || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(task.assignedTo.name, task.assignedTo.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">
                              {task.assignedTo.name || task.assignedTo.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_UNASSIGNED}>Unassigned</SelectItem>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <span className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.image || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(user.name, user.email)}
                              </AvatarFallback>
                            </Avatar>
                            {user.name || user.email}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Start date */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Start date</span>
                  </div>
                  <Input
                    type="date"
                    value={task.startDate ? task.startDate.split('T')[0] : ''}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="h-8 w-full text-sm"
                  />
                </div>

                {/* Due date */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Due date</span>
                  </div>
                  <Input
                    type="date"
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="h-8 w-full text-sm"
                  />
                </div>

                <Separator />

                {/* Priority */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Flag className="h-3.5 w-3.5" />
                    <span>Priority</span>
                  </div>
                  <Select
                    value={task.priority}
                    onValueChange={(val) => handlePriorityChange(val as TaskPriority)}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              priorityConfig[task.priority]?.dotColor
                            )}
                          />
                          {priorityConfig[task.priority]?.label || task.priority}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(priorityConfig) as TaskPriority[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                priorityConfig[key].dotColor
                              )}
                            />
                            {priorityConfig[key].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Project (read-only) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Project</span>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {task.project?.name || 'Unknown'}
                  </p>
                </div>

                {/* Room (if present) */}
                {task.room && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DoorOpen className="h-3.5 w-3.5" />
                      <span>Room</span>
                    </div>
                    <p className="text-sm truncate">
                      {task.room.name || task.room.type}
                    </p>
                  </div>
                )}

                {/* Phase (if present) */}
                {task.stage && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      <span>Phase</span>
                    </div>
                    <p className="text-sm truncate">
                      {task.stage.type}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Created by */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Created by</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={task.createdBy?.image || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(
                          task.createdBy?.name || null,
                          task.createdBy?.email || ''
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {task.createdBy?.name || task.createdBy?.email || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Created at */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Created</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(task.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
