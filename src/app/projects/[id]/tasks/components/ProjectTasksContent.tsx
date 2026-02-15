'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, List, LayoutGrid, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import TaskListView from '@/components/tasks/TaskListView'
import TaskKanbanView from '@/components/tasks/TaskKanbanView'
import TaskFilters from '@/components/tasks/TaskFilters'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import QuickTaskInput from '@/components/tasks/QuickTaskInput'
import type { TaskData, TaskUser, TaskStatus, TaskPriority } from '@/components/tasks/types'

interface ProjectTasksContentProps {
  project: { id: string; name: string }
  rooms: { id: string; name: string | null; type: string }[]
  stages: { id: string; type: string; roomId: string }[]
  users: TaskUser[]
  currentUserId: string
  initialView: string
}

export default function ProjectTasksContent({
  project,
  rooms,
  stages,
  users,
  currentUserId,
  initialView
}: ProjectTasksContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(initialView === 'kanban' ? 'kanban' : 'list')
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assigneeId: '',
    roomId: '',
    search: ''
  })

  // Sync view mode with URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', viewMode)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [viewMode])

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.assigneeId) params.set('assigneeId', filters.assigneeId)
      if (filters.roomId) params.set('roomId', filters.roomId)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/tasks?projectId=${project.id}&view=all&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [project.id, filters])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        const { task: updated } = await res.json()
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
      }
    } catch (err) {
      showError('Failed to update task status')
    }
  }

  const handlePriorityChange = async (taskId: string, priority: TaskPriority) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      })
      if (res.ok) {
        const { task: updated } = await res.json()
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
      }
    } catch (err) {
      showError('Failed to update priority')
    }
  }

  const handleTaskClick = (task: TaskData) => {
    router.push(`/tasks/${task.id}`)
  }

  const handleTaskCreated = (task: TaskData) => {
    setTasks(prev => [task, ...prev])
    success('Task created')
  }

  const handleQuickCreate = async (title: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, projectId: project.id, assignedToId: currentUserId })
      })
      if (res.ok) {
        const { task } = await res.json()
        setTasks(prev => [task, ...prev])
        success('Task created')
      }
    } catch (err) {
      showError('Failed to create task')
    }
  }

  // Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'DONE').length
  const overdueTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE' && t.status !== 'CANCELLED'
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{project.name}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-gray-500">{totalTasks} total</span>
                  <span className="text-xs text-green-600">{completedTasks} done</span>
                  {overdueTasks > 0 && (
                    <span className="text-xs text-red-600">{overdueTasks} overdue</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="bg-rose-500 hover:bg-rose-600">
                <Plus className="w-4 h-4 mr-1" />
                Add Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-3">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableUsers={users}
          availableRooms={rooms}
        />
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
          </div>
        ) : viewMode === 'list' ? (
          <div>
            <TaskListView
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              showProject={false}
            />
            <div className="mt-2">
              <QuickTaskInput onCreateTask={handleQuickCreate} placeholder="Add a task..." />
            </div>
          </div>
        ) : (
          <TaskKanbanView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTaskCreated={handleTaskCreated}
        projectId={project.id}
        availableUsers={users}
        availableRooms={rooms}
        availableStages={stages}
      />
    </div>
  )
}
