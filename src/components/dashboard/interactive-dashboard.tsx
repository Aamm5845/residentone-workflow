'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FolderOpen, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Building, DollarSign, Calendar, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

interface DashboardStats {
  activeProjects: number
  totalClients: number
  pendingApprovals: number
  completedThisMonth: number
  totalRevenue: number
  activeStages: number
  overdueTasks: number
}

interface Task {
  id: string
  title: string
  project: string
  projectId: string
  client: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  status: string
  stageType: string
  roomType: string
  roomId: string
}

interface DashboardData {
  stats: DashboardStats | null
  tasks: Task[]
  recentProjects: any[]
  isLoading: boolean
  error: string | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function InteractiveDashboard({ user }: { user: any }) {
  const [refreshing, setRefreshing] = useState(false)
  
  // Fetch dashboard stats
  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR<DashboardStats>('/api/dashboard/stats', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true
  })
  
  // Fetch user tasks
  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useSWR<{tasks: Task[]}>('/api/dashboard/tasks', fetcher, {
    refreshInterval: 15000, // Refresh every 15 seconds
    revalidateOnFocus: true
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([mutateStats(), mutateTasks()])
      toast.success('Dashboard updated!')
    } catch (error) {
      toast.error('Failed to refresh data')
    }
    setRefreshing(false)
  }

  const formatDueDate = (dueDate: string | null): string => {
    if (!dueDate) return 'No due date'
    const date = new Date(dueDate)
    const today = new Date()
    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'Overdue'
    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return 'Due tomorrow'
    if (diffDays <= 7) return `Due in ${diffDays} days`
    return date.toLocaleDateString()
  }

  const isLoading = !statsData || !tasksData
  const hasError = statsError || tasksError

  if (hasError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading dashboard</h3>
          <p className="text-gray-600 mb-4">Unable to fetch dashboard data. Please try again.</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <Toaster position="top-right" />
      
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.name}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            {isLoading ? (
              <span className="animate-pulse">Loading dashboard...</span>
            ) : (
              `You have ${statsData?.activeProjects || 0} active projects and ${statsData?.pendingApprovals || 0} pending approvals`
            )}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Active Projects"
          value={isLoading ? '...' : statsData?.activeProjects?.toString() || '0'}
          icon={FolderOpen}
          color="bg-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Clients"
          value={isLoading ? '...' : statsData?.totalClients?.toString() || '0'}
          icon={Users}
          color="bg-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending Approvals"
          value={isLoading ? '...' : statsData?.pendingApprovals?.toString() || '0'}
          icon={Clock}
          color="bg-orange-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Completed This Month"
          value={isLoading ? '...' : statsData?.completedThisMonth?.toString() || '0'}
          icon={CheckCircle}
          color="bg-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* My Tasks Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
          <span className="text-sm text-gray-500">
            {tasksData?.tasks.length || 0} active tasks
          </span>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : tasksData?.tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending tasks assigned to you</p>
              <p className="text-sm mt-1">Great job staying on top of your work!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasksData?.tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      {!isLoading && statsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(statsData.totalRevenue / 1000).toFixed(0)}k
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Stages</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.activeStages}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.overdueTasks}</p>
              </div>
              <AlertCircle className={`w-8 h-8 ${statsData.overdueTasks > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Task Item Component
function TaskItem({ task }: { task: Task }) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  }

  const statusIcons = {
    NOT_STARTED: '⏳',
    IN_PROGRESS: '🔄',
    COMPLETED: '✅',
    NEEDS_ATTENTION: '🔴',
    ON_HOLD: '⏸️',
    PENDING_APPROVAL: '⏰',
    REVISION_REQUESTED: '🔄'
  }

  const handleTaskClick = () => {
    // Navigate to the specific stage/task
    window.location.href = `/stages/${task.id}`
  }

  return (
    <div 
      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
      onClick={handleTaskClick}
    >
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-white rounded border-2 border-gray-300 flex items-center justify-center">
          <span className="text-lg">{statusIcons[task.status as keyof typeof statusIcons] || '📋'}</span>
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{task.title}</h3>
          <p className="text-sm text-gray-500">
            {task.project} • {task.client} • {formatDueDate(task.dueDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  isLoading 
}: {
  label: string
  value: string
  icon: any
  color: string
  isLoading: boolean
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`${color} p-3 rounded-lg mr-4`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className={`text-2xl font-bold text-gray-900 ${isLoading ? 'animate-pulse' : ''}`}>
            {value}
          </p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  )
}