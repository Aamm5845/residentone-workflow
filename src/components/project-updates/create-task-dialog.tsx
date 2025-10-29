'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toSafeSelectValue, fromSafeSelectValue, NONE_UNASSIGNED } from '@/lib/selectSafe'
import type { CreateTaskData } from '@/lib/api/tasks'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateTask: (data: CreateTaskData) => Promise<void>
  availableUsers: Array<{ id: string; name: string; email: string }>
  availableContractors: Array<{ id: string; businessName: string; specialty?: string }>
  projectRooms?: Array<{ id: string; name: string; type: string }>
}

const priorityOptions = [
  { value: 'URGENT', label: 'Urgent', color: 'text-red-600' },
  { value: 'HIGH', label: 'High', color: 'text-orange-600' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-600' },
  { value: 'LOW', label: 'Low', color: 'text-green-600' },
  { value: 'NORMAL', label: 'Normal', color: 'text-gray-600' }
]

const statusOptions = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'DONE', label: 'Done' }
]

const tradeTypes = [
  'electrical',
  'plumbing', 
  'construction',
  'painting',
  'hvac',
  'flooring',
  'roofing',
  'general'
]

export default function CreateTaskDialog({
  open,
  onOpenChange,
  onCreateTask,
  availableUsers,
  availableContractors,
  projectRooms = []
}: CreateTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<{
    title: string
    description: string
    status: string
    priority: string
    assigneeId: string
    contractorId: string
    tradeType: string
    estimatedHours: string
    estimatedCost: string
    dueDate: string
    roomId: string
  }>({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: NONE_UNASSIGNED,
    contractorId: NONE_UNASSIGNED,
    tradeType: '',
    estimatedHours: '',
    estimatedCost: '',
    dueDate: '',
    roomId: NONE_UNASSIGNED
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      return
    }

    setIsSubmitting(true)
    
    try {
      const createData: CreateTaskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status as CreateTaskData['status'],
        priority: formData.priority as CreateTaskData['priority'],
        assigneeId: fromSafeSelectValue(formData.assigneeId),
        contractorId: fromSafeSelectValue(formData.contractorId),
        tradeType: formData.tradeType || undefined,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        roomId: fromSafeSelectValue(formData.roomId)
      }
      
      await onCreateTask(createData)
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: NONE_UNASSIGNED,
        contractorId: NONE_UNASSIGNED,
        tradeType: '',
        estimatedHours: '',
        estimatedCost: '',
        dueDate: '',
        roomId: NONE_UNASSIGNED
      })
      
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to track work items and assign team members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Describe the task details..."
                rows={3}
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => updateFormData('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => updateFormData('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={formData.assigneeId} onValueChange={(value) => updateFormData('assigneeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_UNASSIGNED}>Unassigned</SelectItem>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contractor */}
            <div>
              <Label htmlFor="contractor">Contractor</Label>
              <Select value={formData.contractorId} onValueChange={(value) => updateFormData('contractorId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contractor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_UNASSIGNED}>None</SelectItem>
                  {availableContractors.map(contractor => (
                    <SelectItem key={contractor.id} value={contractor.id}>
                      {contractor.businessName}
                      {contractor.specialty && <span className="text-gray-500 ml-1">({contractor.specialty})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trade Type */}
            <div>
              <Label htmlFor="tradeType">Trade Type</Label>
              <Select value={formData.tradeType} onValueChange={(value) => updateFormData('tradeType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {tradeTypes.map(trade => (
                    <SelectItem key={trade} value={trade}>
                      {trade.charAt(0).toUpperCase() + trade.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room */}
            {projectRooms.length > 0 && (
              <div>
                <Label htmlFor="room">Room</Label>
                <Select value={formData.roomId} onValueChange={(value) => updateFormData('roomId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_UNASSIGNED}>No specific room</SelectItem>
                    {projectRooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due Date */}
            <div className="md:col-span-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => updateFormData('dueDate', e.target.value)}
              />
            </div>

            {/* Estimated Hours */}
            <div>
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => updateFormData('estimatedHours', e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>

            {/* Estimated Cost */}
            <div>
              <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
              <Input
                id="estimatedCost"
                type="number"
                value={formData.estimatedCost}
                onChange={(e) => updateFormData('estimatedCost', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
