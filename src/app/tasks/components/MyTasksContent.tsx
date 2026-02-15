'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, List, LayoutGrid, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import TaskListView from '@/components/tasks/TaskListView'
import TaskKanbanView from '@/components/tasks/TaskKanbanView'
import TaskFilters from '@/components/tasks/TaskFilters'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import QuickTaskInput from '@/components/tasks/QuickTaskInput'
import type { TaskData, TaskUser, TaskStatus, TaskPriority } from '@/components/tasks/types'

interface MyTasksContentProps {
  users: TaskUser[]
  projects: { id: string; name: string }[]
  currentUserId: string
  currentUserName: string
  initialView: string
  initialTab: string
}

export default function MyTasksContent({
  users,
  projects,
  currentUserId,
  currentUserName,
  initialView,
  initialTab
}: MyTasksContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(initialView === 'kanban' ? 'kanban' : 'list')
  const [activeTab, setActiveTab] = useState(initialTab)
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

  // Sync with URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', viewMode)
    params.set('tab', activeTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [viewMode, activeTab])

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('view', activeTab)
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filters])

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
    if (projects.length === 0) {
      showError('No projects available')
      return
    }
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          projectId: projects[0].id,
          assignedToId: currentUserId
        })
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

  const tabs = [
    { id: 'assigned_to_me', label: 'Assigned to Me' },
    { id: 'created_by_me', label: 'Created by Me' },
    { id: 'all', label: 'All My Tasks' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Tasks</h1>
                <div className="flex items-center gap-4 mt-0.5">
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

          {/* Section tabs */}
          <div className="flex items-center gap-1 mt-4 p-1 bg-gray-100 rounded-lg w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableUsers={users}
          showProjectFilter
          availableProjects={projects}
        />
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
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
              showProject
              groupBy="project"
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
        availableUsers={users}
        availableProjects={projects}
      />
    </div>
  )
}
