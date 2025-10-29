'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Circle,
  Play,
  Pause,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  Paperclip,
  DollarSign,
  Timer,
  Target,
  Users,
  Flag,
  Filter,
  Search,
  SortAsc,
  ArrowRight,
  Construction,
  Zap,
  Wrench,
  Droplets,
  Paintbrush,
  Eye,
  EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { toSafeFilterValue, fromSafeFilterValue, ALL_ANY } from '@/lib/selectSafe'
import { useToast } from '@/components/ui/toast'
import CreateTaskDialog from './create-task-dialog'
import TaskCalendar from './task-calendar'

interface Task {
  id: string
  updateId?: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  assigneeId?: string
  contractorId?: string
  tradeType?: string
  estimatedHours?: number
  actualHours?: number
  estimatedCost?: number
  actualCost?: number
  materials?: Array<{ name: string; quantity: number; cost?: number }>
  dependencies: string[]
  dueDate?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  assignee?: {
    id: string
    name: string
    email: string
    image?: string
  }
  contractor?: {
    id: string
    businessName: string
    contactName: string
    specialty?: string
  }
  createdBy: {
    id: string
    name: string
    email: string
  }
  _count?: {
    messages: number
    attachments: number
  }
}

interface TaskBoardProps {
  projectId: string
  updateId?: string
  tasks: Task[]
  onTaskCreate?: (task: Partial<Task>) => void
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void
  onTaskDelete?: (taskId: string) => void
  canEdit?: boolean
  showDependencies?: boolean
  availableUsers?: Array<{ id: string; name: string; email: string; image?: string }>
  availableContractors?: Array<{ id: string; businessName: string; specialty?: string }>
}

const statusConfig = {
  TODO: {
    label: 'To Do',
    color: 'bg-gray-100 text-gray-800',
    icon: Circle
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800',
    icon: Play
  },
  REVIEW: {
    label: 'Review',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Eye
  },
  DONE: {
    label: 'Done',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle
  }
}

const priorityConfig = {
  URGENT: { label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-700' },
  HIGH: { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-700' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  LOW: { label: 'Low', color: 'bg-green-500', textColor: 'text-green-700' },
  NORMAL: { label: 'Normal', color: 'bg-gray-500', textColor: 'text-gray-700' }
}

const tradeIcons = {
  electrical: Zap,
  plumbing: Droplets,
  construction: Construction,
  painting: Paintbrush,
  general: Wrench
}

export default function TaskBoard({
  projectId,
  updateId,
  tasks,
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete,
  canEdit = false,
  showDependencies = true,
  availableUsers = [],
  availableContractors = []
}: TaskBoardProps) {
  const { success, error: showError } = useToast()
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban')
  const [showCompleted, setShowCompleted] = useState(true)
  const [filterPriority, setFilterPriority] = useState<string>(ALL_ANY)
  const [filterAssignee, setFilterAssignee] = useState<string>(ALL_ANY)
  const [filterTradeType, setFilterTradeType] = useState<string>(ALL_ANY)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

  // Filter and organize tasks
  const filteredTasks = tasks.filter(task => {
    if (!showCompleted && task.status === 'DONE') return false
    
    const safePriority = fromSafeFilterValue(filterPriority)
    const safeAssignee = fromSafeFilterValue(filterAssignee)
    const safeTradeType = fromSafeFilterValue(filterTradeType)
    
    if (safePriority && task.priority !== safePriority) return false
    if (safeAssignee && task.assigneeId !== safeAssignee) return false
    if (safeTradeType && task.tradeType !== safeTradeType) return false
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Group tasks by status for Kanban view
  const tasksByStatus = {
    TODO: filteredTasks.filter(task => task.status === 'TODO'),
    IN_PROGRESS: filteredTasks.filter(task => task.status === 'IN_PROGRESS'),
    REVIEW: filteredTasks.filter(task => task.status === 'REVIEW'),
    DONE: filteredTasks.filter(task => task.status === 'DONE')
  }

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit || !onTaskUpdate) return

    const { source, destination, draggableId } = result
    
    if (source.droppableId === destination.droppableId) {
      // Same column - just reordering (we're not implementing ordering in this example)
      return
    }

    // Different columns - update task status
    const newStatus = destination.droppableId as Task['status']
    const task = tasks.find(t => t.id === draggableId)
    
    if (!task) return

    try {
      await onTaskUpdate(draggableId, { 
        status: newStatus,
        ...(newStatus === 'IN_PROGRESS' && !task.startedAt && {
          startedAt: new Date().toISOString()
        }),
        ...(newStatus === 'DONE' && {
          completedAt: new Date().toISOString()
        })
      })
      
      success('Task Updated', `Task moved to ${statusConfig[newStatus].label.toLowerCase()}`)
    } catch (error) {
      showError('Update Failed', 'Failed to update task status. Please try again.')
    }
  }

  const handleCreateTask = async (data: any) => {
    if (onTaskCreate) {
      await onTaskCreate(data)
    }
  }

  const handleConfirmDelete = async () => {
    if (taskToDelete && onTaskDelete) {
      try {
        await onTaskDelete(taskToDelete)
        success('Task Deleted', 'Task deleted successfully')
      } catch (error) {
        showError('Delete Failed', error instanceof Error ? error.message : 'Failed to delete task')
      }
    }
    setDeleteConfirmOpen(false)
    setTaskToDelete(null)
  }

  const TaskCard = ({ task, index }: { task: Task; index: number }) => {
    const StatusIcon = statusConfig[task.status].icon
    const TradeIcon = task.tradeType && tradeIcons[task.tradeType as keyof typeof tradeIcons]
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'

    return (
      <Draggable draggableId={task.id} index={index} isDragDisabled={!canEdit}>
        {(provided, snapshot) => (
          <motion.div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className={`${snapshot.isDragging ? 'rotate-3 scale-105' : ''}`}
          >
            <Card 
              className={`mb-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
                isOverdue ? 'border-red-300 bg-red-50' : ''
              } ${
                snapshot.isDragging ? 'shadow-xl border-blue-300' : ''
              }`}
              onClick={() => {
                setSelectedTask(task)
                setTaskDialogOpen(true)
              }}
            >
              <CardContent className="p-4">
                {/* Header with priority and actions */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-3 h-3 rounded-full ${priorityConfig[task.priority].color}`} />
                    {TradeIcon && <TradeIcon className="w-4 h-4 text-gray-500" />}
                    {isOverdue && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>Overdue</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTask(task)
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setTaskToDelete(task.id)
                            setDeleteConfirmOpen(true)
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Title and description */}
                <div className="space-y-2 mb-3">
                  <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
                  {task.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  {/* Assignee/Contractor */}
                  {(task.assignee || task.contractor) && (
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-3 h-3 text-gray-400" />
                      {task.assignee ? (
                        <div className="flex items-center gap-1">
                          <Avatar className="w-4 h-4">
                            <AvatarImage src={task.assignee.image} />
                            <AvatarFallback className="text-xs">
                              {task.assignee.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-gray-600">{task.assignee.name}</span>
                        </div>
                      ) : task.contractor ? (
                        <span className="text-gray-600">
                          {task.contractor.businessName}
                          {task.contractor.specialty && ` (${task.contractor.specialty})`}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Due date */}
                  {task.dueDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Time tracking */}
                  {(task.estimatedHours || task.actualHours) && (
                    <div className="flex items-center gap-2 text-xs">
                      <Timer className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">
                        {task.actualHours ? `${task.actualHours}h` : `~${task.estimatedHours}h`}
                      </span>
                    </div>
                  )}

                  {/* Cost */}
                  {(task.estimatedCost || task.actualCost) && (
                    <div className="flex items-center gap-2 text-xs">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">
                        {task.actualCost ? `$${task.actualCost}` : `~$${task.estimatedCost}`}
                      </span>
                    </div>
                  )}

                  {/* Dependencies */}
                  {showDependencies && task.dependencies.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Target className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">
                        {task.dependencies.length} dependencies
                      </span>
                    </div>
                  )}

                  {/* Activity indicators */}
                  {task._count && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      {task._count.messages > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task._count.messages}</span>
                        </div>
                      )}
                      {task._count.attachments > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Paperclip className="w-3 h-3" />
                          <span>{task._count.attachments}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </Draggable>
    )
  }

  const KanbanColumn = ({ status, tasks: columnTasks }: { status: keyof typeof statusConfig; tasks: Task[] }) => {
    const StatusIcon = statusConfig[status].icon
    
    return (
      <div className="flex-1 min-w-80">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-2">
          <div className="flex items-center gap-3">
            <StatusIcon className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">{statusConfig[status].label}</h3>
            <Badge variant="secondary" className="text-xs">
              {columnTasks.length}
            </Badge>
          </div>
          
          {canEdit && status === 'TODO' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreateTaskDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        <Droppable droppableId={status}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-96 p-2 rounded-lg transition-colors duration-200 ${
                snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
              }`}
            >
              <AnimatePresence>
                {columnTasks.map((task, index) => (
                  <TaskCard key={task.id} task={task} index={index} />
                ))}
              </AnimatePresence>
              {provided.placeholder}
              
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <StatusIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tasks in {statusConfig[status].label.toLowerCase()}</p>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Task Board</h3>
          <p className="text-sm text-gray-500">
            {filteredTasks.length} tasks • {tasksByStatus.DONE.length} completed
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          {/* Filters */}
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ANY}>All Priorities</SelectItem>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ANY}>All Assignees</SelectItem>
              {availableUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTradeType} onValueChange={setFilterTradeType}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Trade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ANY}>All Trades</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="plumbing">Plumbing</SelectItem>
              <SelectItem value="construction">Construction</SelectItem>
              <SelectItem value="painting">Painting</SelectItem>
              <SelectItem value="hvac">HVAC</SelectItem>
              <SelectItem value="flooring">Flooring</SelectItem>
              <SelectItem value="roofing">Roofing</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          {/* Show/Hide completed */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showCompleted ? 'Hide' : 'Show'} Completed
          </Button>

          {/* Add task */}
          {canEdit && (
            <Button
              onClick={() => setCreateTaskDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        <Button
          size="sm"
          variant={viewMode === 'kanban' ? 'default' : 'ghost'}
          onClick={() => setViewMode('kanban')}
          className="h-8"
        >
          Kanban
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          onClick={() => setViewMode('list')}
          className="h-8"
        >
          List
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'calendar' ? 'default' : 'ghost'}
          onClick={() => setViewMode('calendar')}
          className="h-8"
        >
          Calendar
        </Button>
      </div>

      {/* Task board content */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-6">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
              <KanbanColumn
                key={status}
                status={status as keyof typeof statusConfig}
                tasks={statusTasks}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No tasks found matching your criteria</p>
            </div>
          ) : (
            filteredTasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <TaskCalendar
          tasks={filteredTasks}
          onTaskClick={(task) => {
            setSelectedTask(task)
            setTaskDialogOpen(true)
          }}
        />
      )}

      {/* Task detail dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedTask && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${priorityConfig[selectedTask.priority].color}`} />
                  {selectedTask.title}
                </DialogTitle>
                <DialogDescription>
                  Created {new Date(selectedTask.createdAt).toLocaleDateString()} by {selectedTask.createdBy.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {selectedTask.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-gray-600 text-sm">{selectedTask.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <Badge className={statusConfig[selectedTask.status].color}>
                          {statusConfig[selectedTask.status].label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Priority:</span>
                        <Badge variant="outline" className={priorityConfig[selectedTask.priority].textColor}>
                          {priorityConfig[selectedTask.priority].label}
                        </Badge>
                      </div>
                      {selectedTask.tradeType && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Trade:</span>
                          <span className="capitalize">{selectedTask.tradeType}</span>
                        </div>
                      )}
                      {selectedTask.dueDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Due Date:</span>
                          <span>{new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Assignment</h4>
                    <div className="space-y-2 text-sm">
                      {selectedTask.assignee && (
                        <div>
                          <span className="text-gray-500 block">Assignee:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={selectedTask.assignee.image} />
                              <AvatarFallback className="text-xs">
                                {selectedTask.assignee.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedTask.assignee.name}</span>
                          </div>
                        </div>
                      )}
                      {selectedTask.contractor && (
                        <div>
                          <span className="text-gray-500 block">Contractor:</span>
                          <span className="mt-1">{selectedTask.contractor.businessName}</span>
                          {selectedTask.contractor.specialty && (
                            <span className="text-gray-400 text-xs block">{selectedTask.contractor.specialty}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time and cost tracking */}
                {(selectedTask.estimatedHours || selectedTask.actualHours || selectedTask.estimatedCost || selectedTask.actualCost) && (
                  <div>
                    <h4 className="font-medium mb-3">Time & Cost</h4>
                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div className="space-y-2">
                        {selectedTask.estimatedHours && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Estimated Hours:</span>
                            <span>{selectedTask.estimatedHours}h</span>
                          </div>
                        )}
                        {selectedTask.actualHours && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Actual Hours:</span>
                            <span>{selectedTask.actualHours}h</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {selectedTask.estimatedCost && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Estimated Cost:</span>
                            <span>${selectedTask.estimatedCost}</span>
                          </div>
                        )}
                        {selectedTask.actualCost && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Actual Cost:</span>
                            <span>${selectedTask.actualCost}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Materials */}
                {selectedTask.materials && selectedTask.materials.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Materials</h4>
                    <div className="space-y-2">
                      {selectedTask.materials.map((material, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{material.name}</span>
                          <span className="text-gray-500">
                            {material.quantity} {material.cost && `• $${material.cost}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {showDependencies && selectedTask.dependencies.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Dependencies</h4>
                    <div className="space-y-2">
                      {selectedTask.dependencies.map(depId => {
                        const depTask = tasks.find(t => t.id === depId)
                        return depTask ? (
                          <div key={depId} className="flex items-center gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span>{depTask.title}</span>
                            <Badge className={statusConfig[depTask.status].color} variant="secondary">
                              {statusConfig[depTask.status].label}
                            </Badge>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        onCreateTask={handleCreateTask}
        availableUsers={availableUsers}
        availableContractors={availableContractors}
        projectRooms={[]}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
