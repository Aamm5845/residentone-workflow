'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FolderOpen, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Building, DollarSign, Calendar, ChevronDown, ChevronUp, Award, X, User, Briefcase, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

interface DashboardStats {
  activeProjects: number
  activeRooms: number
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

interface LastCompletedPhase {
  id: string
  stageType: string
  roomType: string
  roomName?: string
  clientName: string
  projectName: string
  completedAt: string
  completedBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

interface RecentCompletionDto {
  id: string
  stageType: string
  roomType: string
  roomName?: string
  clientName: string
  projectName: string
  completedAt: string
  completedBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

interface PendingApprovalDto {
  id: string
  version: string
  stageId: string
  status: string
  createdAt: string
  roomType: string
  roomName?: string
  projectName: string
  clientName: string
  assetCount: number
  createdBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

interface DashboardData {
  stats: DashboardStats | null
  tasks: Task[]
  recentProjects: any[]
  isLoading: boolean
  error: string | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Helper function to format due dates
const formatDueDate = (dueDate: string | null): string => {
  if (!dueDate) return 'No due date'
  
  // Additional check for invalid dates
  const date = new Date(dueDate)
  if (isNaN(date.getTime())) return 'No due date'
  
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Reset time to start of day for accurate comparison
  
  const dueDateOnly = new Date(date)
  dueDateOnly.setHours(0, 0, 0, 0) // Reset time to start of day
  
  const diffTime = dueDateOnly.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays <= 7) return `Due in ${diffDays} days`
  return date.toLocaleDateString()
}

export default function InteractiveDashboard({ user }: { user: any }) {
  const [tasksCollapsed, setTasksCollapsed] = useState(true)
  const [showRecentCompletions, setShowRecentCompletions] = useState(false)
  const [showPendingApprovals, setShowPendingApprovals] = useState(false)
  
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
  
  // Fetch last completed phase
  const { data: lastPhaseData, error: lastPhaseError, mutate: mutateLastPhase } = useSWR<{data: LastCompletedPhase | null}>('/api/dashboard/last-completed-phase', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true
  })


  const isLoading = !statsData || !tasksData
  const hasError = statsError || tasksError

  if (hasError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading dashboard</h3>
          <p className="text-gray-600">Unable to fetch dashboard data. Please refresh the page.</p>
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
              `You have ${statsData?.activeProjects || 0} active projects and ${statsData?.activeRooms || 0} active rooms`
            )}
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Active Projects"
          value={isLoading ? '...' : statsData?.activeProjects?.toString() || '0'}
          icon={Briefcase}
          color="bg-blue-500"
          isLoading={isLoading}
          href="/projects?status=active"
        />
        <StatCard
          label="Active Rooms"
          value={isLoading ? '...' : statsData?.activeRooms?.toString() || '0'}
          icon={Layers3}
          color="bg-green-500"
          isLoading={isLoading}
          href="/rooms?status=active"
        />
        <StatCard
          label="Pending Approvals"
          value={isLoading ? '...' : statsData?.pendingApprovals?.toString() || '0'}
          icon={Clock}
          color="bg-orange-500"
          isLoading={isLoading}
          onClick={() => setShowPendingApprovals(true)}
        />
        <StatCard
          label="Completed This Month"
          value={isLoading ? '...' : statsData?.completedThisMonth?.toString() || '0'}
          icon={CheckCircle}
          color="bg-purple-500"
          isLoading={isLoading}
          href="/projects?status=completed&timeframe=month"
        />
      </div>

      {/* My Tasks Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {tasksData?.tasks?.length || 0} active tasks
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTasksCollapsed(!tasksCollapsed)}
              className="p-1 h-8 w-8"
            >
              {tasksCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          tasksCollapsed ? 'max-h-0' : 'max-h-[1000px]'
        }`}>
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
          ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending tasks assigned to you</p>
              <p className="text-sm mt-1">Great job staying on top of your work!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasksData.tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      {!isLoading && statsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LastCompletedPhaseCard 
            data={lastPhaseData?.data} 
            isLoading={!lastPhaseData && !lastPhaseError}
            error={lastPhaseError}
            onShowMore={() => setShowRecentCompletions(true)}
          />
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer transform hover:scale-[1.02]" onClick={() => window.location.href = '/stages?status=active'}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Stages</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.activeStages}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className={`rounded-lg shadow-sm border p-6 transition-all duration-200 hover:shadow-md cursor-pointer transform hover:scale-[1.02] ${
            statsData.overdueTasks > 0 
              ? 'bg-red-50 border-red-200 hover:border-red-300' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`} onClick={() => window.location.href = '/tasks?status=overdue'}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  statsData.overdueTasks > 0 ? 'text-red-700' : 'text-gray-600'
                }`}>Overdue Items</p>
                <p className={`text-2xl font-bold ${
                  statsData.overdueTasks > 0 ? 'text-red-900' : 'text-gray-900'
                }`}>{statsData.overdueTasks}</p>
                {statsData.overdueTasks > 0 && (
                  <p className="text-xs text-red-600 font-medium mt-1">
                    Requires immediate attention!
                  </p>
                )}
              </div>
              <div className="relative">
                <AlertCircle className={`w-8 h-8 ${statsData.overdueTasks > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                {statsData.overdueTasks > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Completions Modal */}
      <RecentCompletionsModal 
        isOpen={showRecentCompletions} 
        onClose={() => setShowRecentCompletions(false)} 
      />

      {/* Pending Approvals Modal */}
      <PendingApprovalsModal 
        isOpen={showPendingApprovals} 
        onClose={() => setShowPendingApprovals(false)} 
      />

    </div>
  )
}

// Task Item Component
function TaskItem({ task }: { task: Task }) {
  // Only calculate overdue/due soon if there's actually a due date
  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
  const isDueSoon = task.dueDate && !isOverdue && 
    (new Date(task.dueDate).getTime() - new Date().getTime()) <= (3 * 24 * 60 * 60 * 1000) // 3 days
  
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
      className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all duration-200 ${
        isOverdue 
          ? 'bg-red-50 border border-red-200 hover:bg-red-100 shadow-md' 
          : isDueSoon
          ? 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100' 
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
      onClick={handleTaskClick}
    >
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-white rounded border-2 border-gray-300 flex items-center justify-center">
          <span className="text-lg">{statusIcons[task.status as keyof typeof statusIcons] || '📋'}</span>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className={`font-medium ${
              isOverdue ? 'text-red-900' : isDueSoon ? 'text-yellow-900' : 'text-gray-900'
            }`}>{task.title}</h3>
            {isOverdue && (
              <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                OVERDUE
              </span>
            )}
            {isDueSoon && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full border border-yellow-200">
                DUE SOON
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${
            isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-500'
          }`}>
            {task.project} • {task.client}{task.dueDate ? ` • ${formatDueDate(task.dueDate)}` : ''}
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

// Last Completed Phase Card Component
function LastCompletedPhaseCard({ 
  data, 
  isLoading, 
  error,
  onShowMore
}: {
  data: LastCompletedPhase | null | undefined
  isLoading: boolean
  error: any
  onShowMore: () => void
}) {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Last Completed Phase</p>
            <p className="text-sm text-red-500 mt-1">Error loading data</p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <p className="text-sm font-medium text-gray-600 mb-3">Last Completed Phase</p>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">Last Completed Phase</p>
          <p className="text-sm text-gray-500">No recent completions</p>
        </div>
      </div>
    )
  }

  const formatPhaseName = (stageType: string) => {
    // Handle cases where stageType is already formatted from API
    if (!stageType.includes('_')) {
      return stageType // Already formatted
    }
    
    switch (stageType) {
      case 'DESIGN_CONCEPT':
      case 'DESIGN':
        return 'Design Concept'
      case 'THREE_D':
      case 'RENDERING':
        return '3D Rendering'
      case 'CLIENT_APPROVAL':
        return 'Client Approval'
      case 'DRAWINGS':
        return 'Drawings'
      case 'FFE':
        return 'FFE'
      default:
        return stageType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 transform hover:scale-[1.02]"
      onClick={onShowMore}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 mb-2">Last Completed Phase</p>
          
          {/* Phase Name - Prominent but no color */}
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {formatPhaseName(data.stageType)}
          </h3>
          
          {/* Project and Room */}
          <p className="text-sm font-medium text-gray-700 mb-3">
            {data.projectName} • {data.roomName || data.roomType}
          </p>
          
          {/* Completed By - with profile picture */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0 overflow-hidden">
              {data.completedBy.image ? (
                <Image
                  src={data.completedBy.image}
                  alt={data.completedBy.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm">
                  {data.completedBy.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                Completed by {data.completedBy.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(data.completedAt)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Milestone Icon */}
        <Award className="w-8 h-8 text-purple-500 flex-shrink-0 ml-3" />
      </div>
      
      {/* Click to view more indicator */}
      <div className="flex items-center justify-center pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500 flex items-center">
          <span>Click to view recent completions</span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </p>
      </div>
    </div>
  )
}

// Recent Completions Modal Component
function RecentCompletionsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data: completionsData, error: completionsError } = useSWR<{data: RecentCompletionDto[]}>(
    isOpen ? '/api/dashboard/recent-completions' : null, 
    fetcher
  )

  const formatPhaseName = (stageType: string) => {
    // Handle cases where stageType is already formatted from API
    if (!stageType.includes('_')) {
      return stageType // Already formatted
    }
    
    switch (stageType) {
      case 'DESIGN_CONCEPT':
      case 'DESIGN':
        return 'Design Concept'
      case 'THREE_D':
      case 'RENDERING':
        return '3D Rendering'
      case 'CLIENT_APPROVAL':
        return 'Client Approval'
      case 'DRAWINGS':
        return 'Drawings'
      case 'FFE':
        return 'FFE'
      default:
        return stageType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Completed Phases</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {completionsError ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">Error loading recent completions</p>
            </div>
          ) : !completionsData ? (
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                      <div className="w-16 h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : completionsData.data.length === 0 ? (
            <div className="p-6 text-center">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No completed phases found</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {completionsData.data.map((completion, index) => (
                  <div key={completion.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      {/* Profile Picture/Initial */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                        {completion.completedBy.image ? (
                          <Image
                            src={completion.completedBy.image}
                            alt={completion.completedBy.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">
                            {completion.completedBy.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Phase Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-purple-600 text-sm">
                          {formatPhaseName(completion.stageType)}
                        </h3>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {completion.projectName} • {completion.roomName || completion.roomType}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-gray-600">
                            Completed by {completion.completedBy.name}
                          </p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-500">
                            {formatDate(completion.completedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Order Number */}
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Pending Approvals Modal Component
function PendingApprovalsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data: approvalsData, error: approvalsError } = useSWR<{data: PendingApprovalDto[]}>(
    isOpen ? '/api/dashboard/pending-approvals' : null, 
    fetcher
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleApprovalClick = (stageId: string) => {
    // Navigate to the client approval stage
    window.location.href = `/stages/${stageId}`
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Pending Aaron's Approvals</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {approvalsError ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">Error loading pending approvals</p>
            </div>
          ) : !approvalsData ? (
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                      <div className="w-16 h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : approvalsData.data.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">No pending approvals</p>
              <p className="text-sm text-gray-500 mt-2">All submitted renderings have been approved!</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {approvalsData.data.map((approval, index) => (
                  <div 
                    key={approval.id} 
                    className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => handleApprovalClick(approval.stageId)}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Creator Profile Picture/Initial */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                        {approval.createdBy.image ? (
                          <Image
                            src={approval.createdBy.image}
                            alt={approval.createdBy.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">
                            {approval.createdBy.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Approval Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-orange-600 text-sm">
                            {approval.version}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                            Pending Approval
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {approval.projectName} • {approval.roomName || approval.roomType}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center space-x-1">
                            <p className="text-xs text-gray-600">
                              Created by {approval.createdBy.name}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-500">
                            {formatDate(approval.createdAt)}
                          </p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-500">
                            {approval.assetCount} image{approval.assetCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Action Arrow */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {approvalsData && approvalsData.data.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Click on any item to open the Client Approval phase and review the renderings
            </p>
          </div>
        )}
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
  isLoading,
  href,
  onClick
}: {
  label: string
  value: string
  icon: any
  color: string
  isLoading: boolean
  href?: string
  onClick?: () => void
}) {
  const CardContent = () => (
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
  )

  const cardClasses = `bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 ${
    (href || onClick) ? 'hover:shadow-md hover:border-gray-300 cursor-pointer transform hover:scale-[1.02]' : ''
  }`

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        <CardContent />
      </Link>
    )
  }

  return (
    <div className={cardClasses} onClick={onClick}>
      <CardContent />
    </div>
  )
}
