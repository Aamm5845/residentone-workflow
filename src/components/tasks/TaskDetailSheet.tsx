'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast, ToastContainer } from '@/components/ui/toast'
import { toSafeSelectValue, fromSafeSelectValue, NONE_UNASSIGNED } from '@/lib/selectSafe'
import { cn } from '@/lib/utils'
import {
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
  ChevronDown,
  ChevronRight,
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
} from './types'
import { statusConfig, priorityConfig } from './types'
import { TaskSubtaskList } from './TaskSubtaskList'
import { TaskComments } from './TaskComments'
import { TaskAttachments } from './TaskAttachments'

interface TaskDetailSheetProps {
  task: TaskData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: (task: TaskData) => void
  onTaskDelete: (taskId: string) => void
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

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No due date'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TaskDetailSheet({
  task: propTask,
  open,
  onOpenChange,
  onTaskUpdate,
  onTaskDelete,
  availableUsers,
  availableRooms,
  currentUserId,
}: TaskDetailSheetProps) {
  const { toasts, dismissToast, success, error: showError } = useToast()

  // Full task data fetched from API
  const [taskDetail, setTaskDetail] = useState<TaskData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState('')

  // Collapsible section states
  const [subtasksOpen, setSubtasksOpen] = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  // The task to display (fetched detail or prop fallback)
  const task = taskDetail || propTask

  // Fetch full task details when sheet opens
  useEffect(() => {
    if (open && propTask?.id) {
      setIsLoading(true)
      setTaskDetail(null)

      fetch(`/api/tasks/${propTask.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch task')
          return res.json()
        })
        .then((data) => {
          setTaskDetail(data.task)
        })
        .catch(() => {
          // Fall back to prop task data
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [open, propTask?.id])

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
        onTaskUpdate(data.task)
      } catch (err) {
        showError('Error', err instanceof Error ? err.message : 'Failed to update task')
      }
    },
    [task, taskDetail, onTaskUpdate, showError]
  )

  // --- Field update handlers ---

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task || task.status === newStatus) return
    // Optimistic update
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
      onTaskDelete(task.id)
      onOpenChange(false)
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

  if (!task) return null

  const statusKeys = Object.keys(statusConfig) as TaskStatus[]

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[540px] p-0 flex flex-col"
        >
          {/* Accessible description for screen readers */}
          <SheetDescription className="sr-only">
            Task details and editing panel
          </SheetDescription>

          {isLoading && !task ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 space-y-4">
                <SheetHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    {/* Editable title */}
                    {isEditingTitle ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          ref={titleInputRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle()
                            if (e.key === 'Escape') setIsEditingTitle(false)
                          }}
                          onBlur={handleSaveTitle}
                          className="text-lg font-semibold h-auto py-1"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <SheetTitle
                        className="text-lg font-semibold cursor-pointer hover:text-blue-600 transition-colors flex-1 pr-2"
                        onClick={() => {
                          setEditTitle(task.title)
                          setIsEditingTitle(true)
                        }}
                      >
                        {task.title}
                        <Pencil className="inline h-3.5 w-3.5 ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </SheetTitle>
                    )}

                    {/* Delete dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="shrink-0">
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
                </SheetHeader>

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
              </div>

              <Separator />

              {/* Scrollable content */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-6">
                  {/* Details section */}
                  <div className="space-y-3">
                    {/* Assignee */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <User className="h-4 w-4" />
                        <span>Assignee</span>
                      </div>
                      <Select
                        value={toSafeSelectValue(task.assignedToId)}
                        onValueChange={handleAssigneeChange}
                      >
                        <SelectTrigger className="h-8 w-[200px] text-sm border-none shadow-none hover:bg-slate-100 transition-colors">
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

                    {/* Due date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <Calendar className="h-4 w-4" />
                        <span>Due date</span>
                      </div>
                      <Input
                        type="date"
                        value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        className="h-8 w-[200px] text-sm border-none shadow-none hover:bg-slate-100 transition-colors cursor-pointer"
                      />
                    </div>

                    {/* Priority */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <Flag className="h-4 w-4" />
                        <span>Priority</span>
                      </div>
                      <Select
                        value={task.priority}
                        onValueChange={(val) => handlePriorityChange(val as TaskPriority)}
                      >
                        <SelectTrigger className="h-8 w-[200px] text-sm border-none shadow-none hover:bg-slate-100 transition-colors">
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

                    {/* Project (read-only) */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <FolderOpen className="h-4 w-4" />
                        <span>Project</span>
                      </div>
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {task.project?.name || 'Unknown'}
                      </span>
                    </div>

                    {/* Room (if present) */}
                    {task.room && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                          <DoorOpen className="h-4 w-4" />
                          <span>Room</span>
                        </div>
                        <span className="text-sm truncate max-w-[200px]">
                          {task.room.name || task.room.type}
                        </span>
                      </div>
                    )}

                    {/* Phase (if present) */}
                    {task.stage && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                          <Layers className="h-4 w-4" />
                          <span>Phase</span>
                        </div>
                        <span className="text-sm truncate max-w-[200px]">
                          {task.stage.type}
                        </span>
                      </div>
                    )}

                    {/* Created by */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <User className="h-4 w-4" />
                        <span>Created by</span>
                      </div>
                      <span className="flex items-center gap-2 text-sm">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.createdBy?.image || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(
                              task.createdBy?.name || null,
                              task.createdBy?.email || ''
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[170px]">
                          {task.createdBy?.name || task.createdBy?.email || 'Unknown'}
                        </span>
                      </span>
                    </div>

                    {/* Created at */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[120px]">
                        <Clock className="h-4 w-4" />
                        <span>Created</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(task.createdAt)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Description</h4>
                      {!isEditingDescription && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditDescription(task.description || '')
                            setIsEditingDescription(true)
                          }}
                          className="h-6 w-6"
                        >
                          <Pencil className="h-3 w-3" />
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

                  {/* Subtasks section */}
                  <Collapsible open={subtasksOpen} onOpenChange={setSubtasksOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                      {subtasksOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Subtasks</h4>
                      {(taskDetail?.subtasks?.length || 0) > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {taskDetail?.subtasks?.filter((s) => s.completed).length || 0}/
                          {taskDetail?.subtasks?.length || 0}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <TaskSubtaskList
                        taskId={task.id}
                        subtasks={taskDetail?.subtasks || []}
                        onSubtasksChange={handleSubtasksChange}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Comments section */}
                  <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                      {commentsOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Comments</h4>
                      {(taskDetail?.comments?.length || 0) > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {taskDetail?.comments?.length || 0}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <TaskComments
                        taskId={task.id}
                        comments={taskDetail?.comments || []}
                        currentUserId={currentUserId}
                        onCommentsChange={handleCommentsChange}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Attachments section */}
                  <Collapsible open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                      {attachmentsOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Attachments</h4>
                      {(taskDetail?.attachments?.length || 0) > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {taskDetail?.attachments?.length || 0}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <TaskAttachments
                        taskId={task.id}
                        attachments={taskDetail?.attachments || []}
                        onAttachmentsChange={handleAttachmentsChange}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Bottom padding */}
                  <div className="h-4" />
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
