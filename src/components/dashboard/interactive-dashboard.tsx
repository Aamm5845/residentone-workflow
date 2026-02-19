'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Users, Clock, CheckCircle, AlertCircle, TrendingUp, Calendar, ChevronDown, ChevronUp, Award, X, Briefcase, Layers3, ArrowRight, CheckSquare, Video, MapPin, Building2 } from 'lucide-react'
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

interface UpcomingMeeting {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  locationType: string
  locationDetails?: string | null
  meetingLink?: string | null
  project?: { id: string; name: string } | null
  organizer?: { id: string; name: string | null; email: string } | null
  attendeeCount: number
  attendees: Array<{
    id: string
    type: string
    status: string
    name: string
  }>
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

  // Fetch upcoming meetings (where user is an attendee)
  const { data: meetingsData, error: meetingsError } = useSWR<{meetings: UpcomingMeeting[]}>('/api/dashboard/upcoming-meetings', fetcher, {
    refreshInterval: 60000, // Refresh every minute
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

      {/* Meetings & Tasks — Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <UpcomingMeetingsCard meetings={meetingsData?.meetings || []} />

        {/* My Tasks */}
        <MyTasksCard
          myTasksData={myTasksData}
          myTasksError={myTasksError}
        />
      </div>

      {/* My Active Stages Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#a657f0] rounded-lg flex items-center justify-center">
              <Layers3 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">My Active Stages</h2>
              <p className="text-xs text-gray-500">
                {tasksData?.tasks?.length || 0} active {tasksData?.tasks?.length === 1 ? 'stage' : 'stages'} assigned
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTasksCollapsed(!tasksCollapsed)}
            className="h-8 px-3 hover:bg-[#a657f0]/10 transition-colors text-sm"
          >
            {tasksCollapsed ? 'Show' : 'Hide'}
            {tasksCollapsed ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronUp className="h-4 w-4 ml-1" />}
          </Button>
        </div>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          tasksCollapsed ? 'max-h-0' : 'max-h-[2000px]'
        }`}>
          <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
            <div className="text-center py-10 px-4">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">All caught up!</h3>
              <p className="text-xs text-gray-500">No active stages assigned to you</p>
            </div>
          ) : (
            <div className="space-y-4">
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
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#a657f0]" />
                    <h3 className="text-sm font-semibold text-gray-900">{group.projectName}</h3>
                    <span className="text-xs text-gray-400">{group.clientName}</span>
                  </div>
                  <div className="space-y-1">
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

// Upcoming Meetings Card Component
function UpcomingMeetingsCard({ meetings }: { meetings: UpcomingMeeting[] }) {
  const formatMeetingDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    today.setHours(0, 0, 0, 0)
    tomorrow.setHours(0, 0, 0, 0)
    const meetingDay = new Date(d)
    meetingDay.setHours(0, 0, 0, 0)

    if (meetingDay.getTime() === today.getTime()) return 'Today'
    if (meetingDay.getTime() === tomorrow.getTime()) return 'Tomorrow'

    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'VIRTUAL': return <Video className="w-3.5 h-3.5" />
      case 'OUR_OFFICE': return <Building2 className="w-3.5 h-3.5" />
      default: return <MapPin className="w-3.5 h-3.5" />
    }
  }

  const getLocationLabel = (type: string, details?: string | null) => {
    switch (type) {
      case 'VIRTUAL': return 'Virtual'
      case 'OUR_OFFICE': return 'Our Office'
      case 'ON_SITE': return details || 'On Site'
      case 'IN_OFFICE': return details || 'In Office'
      default: return type
    }
  }

  const hasMeetings = meetings.length > 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Upcoming Meetings</h2>
            <p className="text-[11px] text-gray-400">{meetings.length} upcoming</p>
          </div>
        </div>
        <Link
          href="/calendar"
          className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
        >
          View Calendar
        </Link>
      </div>

      {!hasMeetings ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
          <Calendar className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No upcoming meetings</p>
        </div>
      ) : (
        <div className="flex-1">
          {meetings.map((meeting, idx) => {
            const isToday = formatMeetingDate(meeting.startTime) === 'Today'
            return (
              <div
                key={meeting.id}
                className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                  idx > 0 ? 'border-t border-gray-50' : ''
                } ${isToday ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}
              >
                {/* Date badge */}
                <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center ${
                  isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className="text-[9px] font-semibold uppercase leading-none">
                    {new Date(meeting.startTime).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-base font-bold leading-tight">
                    {new Date(meeting.startTime).getDate()}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isToday && (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded uppercase tracking-wider">
                        Today
                      </span>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{meeting.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      {getLocationIcon(meeting.locationType)}
                      <span className="truncate max-w-[100px]">{getLocationLabel(meeting.locationType, meeting.locationDetails)}</span>
                    </span>
                  </div>
                  {meeting.project && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meeting.project.name} · {meeting.attendeeCount} attendee{meeting.attendeeCount !== 1 ? 's' : ''}</p>
                  )}
                </div>

                {/* Join / Arrow */}
                {meeting.meetingLink && isToday ? (
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join
                  </a>
                ) : (
                  <Link href="/calendar" className="flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-gray-300 hover:text-gray-500 transition-colors" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// My Tasks Card Component — compact, shows first task per project + count
function MyTasksCard({ myTasksData, myTasksError }: {
  myTasksData: { tasks: MyTask[] } | undefined
  myTasksError: any
}) {
  const [expanded, setExpanded] = useState(false)

  const statusLabels: Record<string, { label: string, color: string }> = {
    TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-600' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    REVIEW: { label: 'Review', color: 'bg-yellow-100 text-yellow-700' },
  }

  const tasks = myTasksData?.tasks || []
  const isLoading = !myTasksData && !myTasksError

  // Group by project
  const groups = tasks.reduce((acc: Record<string, { projectName: string, tasks: MyTask[] }>, task) => {
    if (!acc[task.project.id]) {
      acc[task.project.id] = { projectName: task.project.name, tasks: [] }
    }
    acc[task.project.id].tasks.push(task)
    return acc
  }, {})

  // Collapsed view: show first 3 tasks total
  const collapsedLimit = 3
  const flatTasks = tasks
  const visibleTasks = expanded ? flatTasks : flatTasks.slice(0, collapsedLimit)
  const hiddenCount = flatTasks.length - collapsedLimit

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">My Tasks</h2>
            <p className="text-[11px] text-gray-400">{tasks.length} active {tasks.length === 1 ? 'task' : 'tasks'}</p>
          </div>
        </div>
        <Link
          href="/tasks?tab=assigned_to_me"
          className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline"
        >
          View All
        </Link>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-10 bg-gray-100 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-sm text-gray-500">No open tasks</p>
        </div>
      ) : (
        <div className="flex-1">
          {visibleTasks.map((task, idx) => {
            const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
            const statusInfo = statusLabels[task.status] || statusLabels.TODO

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                  idx > 0 ? 'border-t border-gray-50' : ''
                }`}
                onClick={() => window.location.href = `/tasks/${task.id}`}
              >
                {/* Priority indicator */}
                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                  task.priority === 'URGENT' ? 'bg-red-500' :
                  task.priority === 'HIGH' ? 'bg-orange-400' :
                  'bg-gray-200'
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400 truncate">{task.project.name}</span>
                    <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {task.dueDate && (
                      <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {formatDueDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              </div>
            )
          })}

          {/* Show more / less */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-5 py-2.5 border-t border-gray-100 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>+{hiddenCount} more task{hiddenCount !== 1 ? 's' : ''} <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
      )}
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
