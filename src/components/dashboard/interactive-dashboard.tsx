'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { FolderOpen, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Building, DollarSign, Calendar, ChevronDown, ChevronUp, Award, X, User, Briefcase, Layers3, Timer, Sparkles, Play, FileText, Eye, ArrowRight, CheckSquare, MessageSquare, Circle } from 'lucide-react'
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

interface MyTask {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  dueDate: string | null
  project: { id: string; name: string }
  _count: { subtasks: number; comments: number }
  completedSubtasks: number
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
  const [myTasksCollapsed, setMyTasksCollapsed] = useState(false)
  const [showRecentCompletions, setShowRecentCompletions] = useState(false)
  const [showPendingApprovals, setShowPendingApprovals] = useState(false)
  const [greeting, setGreeting] = useState('Hello')

  // Set greeting on client-side only to avoid hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
  }, [])
  
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
  
  // Fetch my tasks (task management tasks assigned to user)
  const { data: myTasksData, error: myTasksError } = useSWR<{tasks: MyTask[]}>('/api/dashboard/my-tasks', fetcher, {
    refreshInterval: 15000,
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
            {greeting}, {user.name}!
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
          color="bg-[#a657f0]"
          isLoading={isLoading}
          href="/projects?status=active"
        />
        <StatCard
          label="Active Rooms"
          value={isLoading ? '...' : statsData?.activeRooms?.toString() || '0'}
          icon={Layers3}
          color="bg-[#14b8a6]"
          isLoading={isLoading}
          href="/rooms?status=active"
        />
        <StatCard
          label="Pending Approvals"
          value={isLoading ? '...' : statsData?.pendingApprovals?.toString() || '0'}
          icon={Clock}
          color="bg-[#f6762e]"
          isLoading={isLoading}
          onClick={() => setShowPendingApprovals(true)}
        />
        <StatCard
          label="Completed This Month"
          value={isLoading ? '...' : statsData?.completedThisMonth?.toString() || '0'}
          icon={CheckCircle}
          color="bg-[#e94d97]"
          isLoading={isLoading}
          href="/projects?status=completed&timeframe=month"
        />
      </div>

      {/* My Active Stages Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#a657f0] rounded-xl flex items-center justify-center">
              <Layers3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Active Stages</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {tasksData?.tasks?.length || 0} active {tasksData?.tasks?.length === 1 ? 'stage' : 'stages'} assigned
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTasksCollapsed(!tasksCollapsed)}
            className="h-9 px-3 hover:bg-[#a657f0]/10 transition-colors"
          >
            {tasksCollapsed ? (
              <>
                <span className="text-sm font-medium mr-2">Show</span>
                <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                <span className="text-sm font-medium mr-2">Hide</span>
                <ChevronUp className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          tasksCollapsed ? 'max-h-0' : 'max-h-[2000px]'
        }`}>
          <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded-2xl"></div>
                </div>
              ))}
            </div>
          ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-600">No active stages assigned to you</p>
              <p className="text-sm text-gray-500 mt-1">Great job staying on top of your work!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(
                tasksData.tasks.reduce((groups: Record<string, { projectName: string, clientName: string, tasks: Task[] }>, task) => {
                  if (!groups[task.projectId]) {
                    groups[task.projectId] = { projectName: task.project, clientName: task.client, tasks: [] }
                  }
                  groups[task.projectId].tasks.push(task)
                  return groups
                }, {})
              ).map(([projectId, group]) => (
                <div key={projectId}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2 h-2 rounded-full bg-[#a657f0]" />
                    <h3 className="text-sm font-semibold text-gray-900">{group.projectName}</h3>
                    <span className="text-xs text-gray-500">{group.clientName}</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.tasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Tasks</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {myTasksData?.tasks?.length || 0} active {myTasksData?.tasks?.length === 1 ? 'task' : 'tasks'} assigned to you
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/tasks?tab=assigned_to_me"
              className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline"
            >
              View All
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMyTasksCollapsed(!myTasksCollapsed)}
              className="h-9 px-3 hover:bg-rose-500/10 transition-colors"
            >
              {myTasksCollapsed ? (
                <>
                  <span className="text-sm font-medium mr-2">Show</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span className="text-sm font-medium mr-2">Hide</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          myTasksCollapsed ? 'max-h-0' : 'max-h-[2000px]'
        }`}>
          <div className="p-6">
            {!myTasksData && !myTasksError ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : !myTasksData?.tasks || myTasksData.tasks.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No open tasks!</h3>
                <p className="text-gray-600">You don&apos;t have any tasks assigned right now</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  myTasksData.tasks.reduce((groups: Record<string, { projectName: string, tasks: MyTask[] }>, task) => {
                    if (!groups[task.project.id]) {
                      groups[task.project.id] = { projectName: task.project.name, tasks: [] }
                    }
                    groups[task.project.id].tasks.push(task)
                    return groups
                  }, {})
                ).map(([projectId, group]) => (
                  <div key={projectId}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <h3 className="text-sm font-semibold text-gray-900">{group.projectName}</h3>
                      <span className="text-xs text-gray-400">{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.tasks.map((task) => (
                        <MyTaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
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
              <TrendingUp className="w-8 h-8 text-[#14b8a6]" />
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
  
  const handleTaskClick = () => {
    // Navigate to the specific stage/task
    window.location.href = `/stages/${task.id}`
  }

  const formatTaskTitle = (title: string, stageType: string, roomType: string) => {
    // Format phase names properly
    const phaseName = stageType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    // Format room type properly
    const formattedRoom = roomType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    return { phase: phaseName, room: formattedRoom }
  }

  const { phase, room } = formatTaskTitle(task.title, task.stageType, task.roomType)

  return (
    <div 
      className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 ${
        isOverdue 
          ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' 
          : isDueSoon
          ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-500' 
          : 'bg-white hover:bg-gray-50 border-l-4 border-gray-300 hover:border-[#a657f0]'
      } border border-gray-200 hover:border-gray-300 hover:shadow-md`}
      onClick={handleTaskClick}
    >
      <div className="px-4 py-3">
        {/* Single row layout */}
        <div className="flex items-center gap-3">
          {/* Main content - takes most space */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-sm truncate ${
                isOverdue ? 'text-red-900' : isDueSoon ? 'text-amber-900' : 'text-gray-900'
              }`}>{phase}</h3>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-600 truncate">{room}</span>
              {task.dueDate && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className={`text-xs font-medium ${
                    isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-500'
                  }`}>{formatDueDate(task.dueDate)}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Right side badges - compact */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOverdue && (
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                OVERDUE
              </span>
            )}
            {isDueSoon && !isOverdue && (
              <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                DUE SOON
              </span>
            )}

            <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </div>
  )
}

// My Task Item Component (for task management tasks)
function MyTaskItem({ task }: { task: MyTask }) {
  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
  const isDueSoon = task.dueDate && !isOverdue &&
    (new Date(task.dueDate).getTime() - new Date().getTime()) <= (3 * 24 * 60 * 60 * 1000)

  const statusLabels: Record<string, { label: string, color: string }> = {
    TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-600' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    REVIEW: { label: 'Review', color: 'bg-yellow-100 text-yellow-700' },
  }

  const priorityColors: Record<string, string> = {
    URGENT: 'border-red-500',
    HIGH: 'border-orange-500',
    MEDIUM: 'border-gray-300',
    LOW: 'border-green-400',
    NORMAL: 'border-gray-300',
  }

  const statusInfo = statusLabels[task.status] || statusLabels.TODO
  const subtaskTotal = task._count.subtasks
  const subtaskDone = task.completedSubtasks

  return (
    <div
      className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 ${
        isOverdue
          ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500'
          : isDueSoon
          ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-500'
          : `bg-white hover:bg-gray-50 border-l-4 ${priorityColors[task.priority] || 'border-gray-300'} hover:border-rose-500`
      } border border-gray-200 hover:border-gray-300 hover:shadow-md`}
      onClick={() => window.location.href = `/tasks/${task.id}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-sm truncate ${
                isOverdue ? 'text-red-900' : isDueSoon ? 'text-amber-900' : 'text-gray-900'
              }`}>{task.title}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {task.dueDate && (
                <span className={`flex items-center gap-1 text-xs ${
                  isOverdue ? 'text-red-600 font-medium' : isDueSoon ? 'text-amber-600 font-medium' : 'text-gray-500'
                }`}>
                  <Calendar className="w-3 h-3" />
                  {formatDueDate(task.dueDate)}
                </span>
              )}
              {subtaskTotal > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <CheckSquare className="w-3 h-3" />
                  {subtaskDone}/{subtaskTotal}
                </span>
              )}
              {task._count.comments > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MessageSquare className="w-3 h-3" />
                  {task._count.comments}
                </span>
              )}
            </div>
          </div>

          {/* Right side badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOverdue && (
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                OVERDUE
              </span>
            )}
            {isDueSoon && !isOverdue && (
              <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                DUE SOON
              </span>
            )}
            {task.priority === 'URGENT' && !isOverdue && !isDueSoon && (
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">
                URGENT
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
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
    
    switch (stageType.toUpperCase()) {
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
        // Special case for three_d variations
        if (stageType.toUpperCase().includes('THREE') || stageType.toUpperCase().includes('3D')) {
          return '3D Rendering'
        }
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
            <div className="w-8 h-8 rounded-full bg-[#a657f0] flex items-center justify-center text-white text-sm font-medium flex-shrink-0 overflow-hidden">
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
        <Award className="w-8 h-8 text-[#a657f0] flex-shrink-0 ml-3" />
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
    
    switch (stageType.toUpperCase()) {
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
        // Special case for three_d variations
        if (stageType.toUpperCase().includes('THREE') || stageType.toUpperCase().includes('3D')) {
          return '3D Rendering'
        }
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
                      <div className="w-12 h-12 rounded-full bg-[#a657f0] flex items-center justify-center text-white font-medium flex-shrink-0">
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
                        <h3 className="font-semibold text-[#a657f0] text-sm">
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
                        <div className="w-6 h-6 bg-[#a657f0]/15 text-[#a657f0] rounded-full flex items-center justify-center text-xs font-medium">
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
                      <div className="w-12 h-12 rounded-full bg-[#6366ea] flex items-center justify-center text-white font-medium flex-shrink-0">
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
