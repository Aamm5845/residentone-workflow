'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { ToastContainer } from '@/components/ui/toast'
import { toSafeSelectValue, fromSafeSelectValue, NONE_UNASSIGNED } from '@/lib/selectSafe'
import { Loader2, Plus, X, ListChecks, MessageSquare } from 'lucide-react'
import type { TaskData, TaskUser, TaskStatus, TaskPriority } from './types'
import { statusConfig, priorityConfig } from './types'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated: (task: TaskData) => void
  projectId?: string
  availableUsers: TaskUser[]
  availableProjects?: { id: string; name: string }[]
  availableRooms?: { id: string; name: string | null; type: string }[]
  availableStages?: { id: string; type: string; roomId: string }[]
  requireAssignee?: boolean
}

export default function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  projectId: propProjectId,
  availableUsers,
  availableProjects,
  availableRooms: propAvailableRooms,
  availableStages,
  requireAssignee = true,
}: CreateTaskDialogProps) {
  const { toasts, dismissToast, success, error: showError } = useToast()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(propProjectId || '')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedStageId, setSelectedStageId] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [initialComment, setInitialComment] = useState('')

  // Dynamic room & stage fetching state
  const [fetchedRooms, setFetchedRooms] = useState<{ id: string; name: string | null; type: string }[]>([])
  const [fetchedStages, setFetchedStages] = useState<{ id: string; type: string; roomId: string }[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  // Derived: the effective project ID
  const effectiveProjectId = propProjectId || selectedProjectId

  // Use fetched rooms/stages if no static ones were provided
  const filteredRooms = propAvailableRooms && propAvailableRooms.length > 0
    ? propAvailableRooms
    : fetchedRooms

  const allStages = availableStages && availableStages.length > 0
    ? availableStages
    : fetchedStages

  // Filtered stages based on selected room
  const filteredStages = allStages.filter(
    (stage) => stage.roomId === selectedRoomId
  )

  // Helper to format stage type for display (e.g. THREE_D -> "Three D", DESIGN_CONCEPT -> "Design Concept")
  const formatStageType = (type: string) =>
    type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

  // Dynamically fetch rooms + stages when project changes
  useEffect(() => {
    setSelectedRoomId('')
    setSelectedStageId('')

    if (!effectiveProjectId) {
      setFetchedRooms([])
      setFetchedStages([])
      return
    }

    // Only fetch dynamically if no static rooms were provided
    if (propAvailableRooms && propAvailableRooms.length > 0) return

    const fetchRoomsAndStages = async () => {
      setLoadingRooms(true)
      try {
        // Fetch rooms and stages in parallel
        const [roomsRes, stagesRes] = await Promise.all([
          fetch(`/api/extension/rooms?projectId=${effectiveProjectId}`),
          fetch(`/api/tasks/project-stages?projectId=${effectiveProjectId}`)
        ])

        if (roomsRes.ok) {
          const roomsData = await roomsRes.json()
          const rooms = (roomsData.rooms || []).map((r: { id: string; name: string | null; displayName?: string; type: string }) => ({
            id: r.id,
            name: r.displayName || r.name,
            type: r.type
          }))
          setFetchedRooms(rooms)
        } else {
          setFetchedRooms([])
        }

        if (stagesRes.ok) {
          const stagesData = await stagesRes.json()
          setFetchedStages(stagesData.stages || [])
        } else {
          setFetchedStages([])
        }
      } catch {
        setFetchedRooms([])
        setFetchedStages([])
      } finally {
        setLoadingRooms(false)
      }
    }

    fetchRoomsAndStages()
  }, [effectiveProjectId, propAvailableRooms])

  useEffect(() => {
    setSelectedStageId('')
  }, [selectedRoomId])

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    if (!propProjectId) setSelectedProjectId('')
    setSelectedRoomId('')
    setSelectedStageId('')
    setAssignedToId('')
    setPriority('MEDIUM')
    setStartDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setStatus('TODO')
    setSubtasks([])
    setInitialComment('')
  }, [propProjectId])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return

    const resolvedProjectId = propProjectId || selectedProjectId
    if (!resolvedProjectId) {
      showError('Error', 'Please select a project')
      return
    }

    if (requireAssignee && !fromSafeSelectValue(assignedToId)) {
      showError('Error', 'Please assign this task to a team member')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assignedToId: fromSafeSelectValue(assignedToId) || undefined,
        roomId: fromSafeSelectValue(selectedRoomId) || undefined,
        stageId: fromSafeSelectValue(selectedStageId) || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      }

      // Decide which endpoint to use
      let url: string
      if (propProjectId) {
        // Project-context create: use the global endpoint but include projectId
        url = '/api/tasks'
        payload.projectId = propProjectId
      } else {
        url = '/api/tasks'
        payload.projectId = selectedProjectId
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create task')
      }

      const data = await response.json()

      // Create subtasks if any were added
      if (subtasks.length > 0) {
        await Promise.all(
          subtasks.map((title, index) =>
            fetch(`/api/tasks/${data.task.id}/subtasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, order: index }),
            })
          )
        )
      }

      // Post initial comment if provided
      if (initialComment.trim()) {
        await fetch(`/api/tasks/${data.task.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: initialComment.trim() }),
        })
      }

      success('Task created', `"${data.task.title}" has been created successfully.`)
      onTaskCreated(data.task)
      onOpenChange(false)
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="task-title"
                placeholder="Enter task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Add a description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Project select - only if no projectId prop */}
            {!propProjectId && availableProjects && (
              <div className="space-y-2">
                <Label htmlFor="task-project">
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={toSafeSelectValue(selectedProjectId)}
                  onValueChange={(val) => setSelectedProjectId(fromSafeSelectValue(val) || '')}
                >
                  <SelectTrigger id="task-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>Select a project</SelectItem>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Two-column layout for Room and Phase */}
            <div className="grid grid-cols-2 gap-4">
              {/* Room select */}
              <div className="space-y-2">
                <Label htmlFor="task-room">Room</Label>
                <Select
                  value={toSafeSelectValue(selectedRoomId)}
                  onValueChange={(val) => setSelectedRoomId(fromSafeSelectValue(val) || '')}
                  disabled={!effectiveProjectId || loadingRooms}
                >
                  <SelectTrigger id="task-room">
                    <SelectValue placeholder={
                      loadingRooms ? 'Loading rooms...' :
                      !effectiveProjectId ? 'Select a project first' :
                      filteredRooms.length === 0 ? 'No rooms available' :
                      'Select room'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>None</SelectItem>
                    {filteredRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name || room.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phase/Stage select */}
              <div className="space-y-2">
                <Label htmlFor="task-stage">Phase / Stage</Label>
                <Select
                  value={toSafeSelectValue(selectedStageId)}
                  onValueChange={(val) => setSelectedStageId(fromSafeSelectValue(val) || '')}
                  disabled={!selectedRoomId || filteredStages.length === 0}
                >
                  <SelectTrigger id="task-stage">
                    <SelectValue placeholder={
                      !selectedRoomId ? 'Select a room first' :
                      filteredStages.length === 0 ? 'No phases available' :
                      'Select phase'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>None</SelectItem>
                    {filteredStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {formatStageType(stage.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Two-column layout for Assignee and Priority */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assignee select */}
              <div className="space-y-2">
                <Label htmlFor="task-assignee">
                  Assignee {requireAssignee && <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={toSafeSelectValue(assignedToId)}
                  onValueChange={(val) => setAssignedToId(fromSafeSelectValue(val) || '')}
                >
                  <SelectTrigger id="task-assignee">
                    <SelectValue placeholder={requireAssignee ? "Select assignee" : "Unassigned"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!requireAssignee && (
                      <SelectItem value={NONE_UNASSIGNED}>Unassigned</SelectItem>
                    )}
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority select */}
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as TaskPriority)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityConfig) as TaskPriority[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${priorityConfig[key].dotColor}`}
                          />
                          {priorityConfig[key].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Two-column layout for Start date and Due date */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start date */}
              <div className="space-y-2">
                <Label htmlFor="task-start-date">Start Date</Label>
                <Input
                  id="task-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* Due date */}
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status select */}
              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as TaskStatus)}
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusConfig) as TaskStatus[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${statusConfig[key].dotColor}`}
                          />
                          {statusConfig[key].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subtasks */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" />
                Subtasks
              </Label>
              {subtasks.length > 0 && (
                <div className="space-y-1">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{st}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(prev => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a subtask..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubtask.trim()) {
                      e.preventDefault()
                      setSubtasks(prev => [...prev, newSubtask.trim()])
                      setNewSubtask('')
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={() => {
                    if (newSubtask.trim()) {
                      setSubtasks(prev => [...prev, newSubtask.trim()])
                      setNewSubtask('')
                    }
                  }}
                  disabled={!newSubtask.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Initial Note */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Initial Note
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add an initial note or comment..."
                value={initialComment}
                onChange={(e) => setInitialComment(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !title.trim() || (requireAssignee && !fromSafeSelectValue(assignedToId))}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
