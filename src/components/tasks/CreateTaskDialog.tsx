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
import { Loader2 } from 'lucide-react'
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
}

export default function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  projectId: propProjectId,
  availableUsers,
  availableProjects,
  availableRooms,
  availableStages,
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
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Derived: the effective project ID
  const effectiveProjectId = propProjectId || selectedProjectId

  // Filtered rooms based on selected project
  const filteredRooms = availableRooms?.filter(
    (room) => !effectiveProjectId || room // Show all rooms; project filtering done server-side if needed
  ) || []

  // Filtered stages based on selected room
  const filteredStages = availableStages?.filter(
    (stage) => stage.roomId === selectedRoomId
  ) || []

  // Reset dependent selects when parent changes
  useEffect(() => {
    setSelectedRoomId('')
    setSelectedStageId('')
  }, [effectiveProjectId])

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
    setDueDate('')
    setStatus('TODO')
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
                >
                  <SelectTrigger id="task-room">
                    <SelectValue placeholder="Select room" />
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
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>None</SelectItem>
                    {filteredStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.type}
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
                <Label htmlFor="task-assignee">Assignee</Label>
                <Select
                  value={toSafeSelectValue(assignedToId)}
                  onValueChange={(val) => setAssignedToId(fromSafeSelectValue(val) || '')}
                >
                  <SelectTrigger id="task-assignee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>Unassigned</SelectItem>
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

            {/* Two-column layout for Due date and Status */}
            <div className="grid grid-cols-2 gap-4">
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !title.trim()}>
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
