'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { FolderOpen, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Building, DollarSign, Calendar, ChevronDown, ChevronUp, Award, X, User, Briefcase, Layers3, Timer, Sparkles, Play, FileText, Eye, ArrowRight } from 'lucide-react'
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

// Feature Announcement Banner Component
function FeatureAnnouncementBanner() {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden until we check localStorage
  const [showDetails, setShowDetails] = useState(false)
  
  // Banner expiry date - set to December 10, 2025 (adjust as needed)
  const BANNER_EXPIRY = new Date('2025-12-10')
  const BANNER_STORAGE_KEY = 'timeline-feature-banner-dismissed'
  
  useEffect(() => {
    // Check if banner should be shown
    const isExpired = new Date() > BANNER_EXPIRY
    const wasDismissed = localStorage.getItem(BANNER_STORAGE_KEY) === 'true'
    setIsDismissed(isExpired || wasDismissed)
  }, [])
  
  const handleDismiss = () => {
    localStorage.setItem(BANNER_STORAGE_KEY, 'true')
    setIsDismissed(true)
  }
  
  if (isDismissed) return null
  
  return (
    <>
      {/* Main Banner - Compact */}
      <div className="relative overflow-hidden rounded-xl bg-[#a657f0] shadow-lg">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
        </div>
        
        {/* Content */}
        <div className="relative px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Icon and text */}
            <div className="flex items-center gap-4 flex-1">
              {/* Icon */}
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                  <Timer className="w-5 h-5 text-white" />
                </div>
              </div>
              
              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-yellow-900">
                    <Sparkles className="w-2.5 h-2.5" />
                    NEW
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Hey team! Time Tracking is here
                  </h3>
                </div>
                
                <p className="text-white/80 text-xs sm:text-sm mt-1 line-clamp-1">
                  Track hours on projects & see what everyone's working on. Start from dashboard or any phase!
                </p>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowDetails(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#a657f0] rounded-lg font-semibold text-xs hover:bg-white/90 transition-all shadow-md hover:shadow-lg"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Learn More</span>
                <span className="sm:hidden">More</span>
              </button>
              
              <Link
                href="/timeline"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white rounded-lg font-semibold text-xs hover:bg-white/30 transition-all border border-white/30"
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline
              </Link>
              
              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/60 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="relative bg-[#a657f0] px-6 py-8 text-white">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
              </div>
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                    <Timer className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
                        <Sparkles className="w-3 h-3" />
                        NEW
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold">Time Tracking Feature</h2>
                    <p className="text-white/80 text-sm mt-1">Track, analyze, and optimize your work</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="px-6 py-6 overflow-y-auto max-h-[50vh]">
              {/* Goals Section */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-[#a657f0]/10 rounded-lg flex items-center justify-center text-[#a657f0]">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  Why We Built This
                </h3>
                <div className="bg-[#a657f0]/5 rounded-xl p-4 border border-[#a657f0]/20">
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[#a657f0] rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">1</span>
                      <span><strong>Project Cost Tracking:</strong> Understand how much time (and money) is spent on each project to price future work accurately</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[#f6762e] rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">2</span>
                      <span><strong>Team Visibility:</strong> See what projects your teammates are currently working on in real-time</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-[#14b8a6] rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">3</span>
                      <span><strong>Workload Balance:</strong> Identify bottlenecks and distribute work more evenly across the team</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* How to Use Section */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-[#14b8a6]/15 rounded-lg flex items-center justify-center text-[#14b8a6]">
                    <FileText className="w-4 h-4" />
                  </span>
                  How to Use
                </h3>
                
                <div className="space-y-4">
                  {/* Method 1 */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#a657f0]/30 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#f6762e] rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        <Play className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Method 1: Quick Start from Dashboard</h4>
                        <p className="text-sm text-gray-600 mb-2">Click the <strong>"Track Time"</strong> button in the top navigation bar, select a project and phase, then start tracking!</p>
                        <div className="inline-flex items-center gap-1 text-xs text-[#f6762e] bg-[#f6762e]/10 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" />
                          Best for quick time entries
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Method 2 */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#a657f0]/30 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#a657f0] rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        <Layers3 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Method 2: Start from a Phase</h4>
                        <p className="text-sm text-gray-600 mb-2">When you're in any project phase (Design, 3D, etc.), click the timer button to start tracking time for that specific task.</p>
                        <div className="inline-flex items-center gap-1 text-xs text-[#a657f0] bg-[#a657f0]/10 px-2 py-1 rounded-full">
                          <Timer className="w-3 h-3" />
                          Auto-links to correct project & phase
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Method 3 */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#a657f0]/30 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Method 3: Manual Entry in Timesheet</h4>
                        <p className="text-sm text-gray-600 mb-2">Go to Timeline → Timesheet to add past time entries manually. Perfect for logging work you forgot to track!</p>
                        <div className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          <Calendar className="w-3 h-3" />
                          Add entries for any date
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Team Activity */}
              <div className="bg-[#14b8a6]/10 rounded-xl p-4 border border-[#14b8a6]/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#14b8a6] rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">See Team Activity</h4>
                    <p className="text-sm text-gray-600">Visit the <strong>Timeline</strong> page to see what everyone is working on right now, and view detailed reports of time spent on each project.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  handleDismiss()
                  setShowDetails(false)
                }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Don't show again
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
                >
                  Close
                </button>
                <Link
                  href="/timeline"
                  onClick={() => setShowDetails(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a657f0] text-white rounded-xl font-semibold text-sm hover:bg-[#a657f0]/90 transition-all shadow-lg hover:shadow-xl"
                >
                  <Clock className="w-4 h-4" />
                  Open Timeline
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
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
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.name}!
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

      {/* Feature Announcement Banner */}
      <FeatureAnnouncementBanner />

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
          color="bg-[#6366ea]"
          isLoading={isLoading}
          href="/projects?status=completed&timeframe=month"
        />
      </div>

      {/* My Tasks Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#a657f0] rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Tasks</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {tasksData?.tasks?.length || 0} active {tasksData?.tasks?.length === 1 ? 'task' : 'tasks'} assigned
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
              <p className="text-gray-600">No pending tasks assigned to you</p>
              <p className="text-sm text-gray-500 mt-1">Great job staying on top of your work!</p>
            </div>
          ) : (
            <div className="space-y-2">
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
  
  const priorityConfig = {
    high: {
      badge: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
      icon: '🔴',
      label: 'High Priority'
    },
    medium: {
      badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
      icon: '🟡',
      label: 'Medium Priority'
    },
    low: {
      badge: 'bg-green-500 text-white',
      icon: '',
      label: 'Low Priority'
    }
  }

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
  const priorityInfo = priorityConfig[task.priority]

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
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-sm truncate ${
                isOverdue ? 'text-red-900' : isDueSoon ? 'text-amber-900' : 'text-gray-900'
              }`}>{phase}</h3>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-600 truncate">{room}</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-medium truncate">{task.project}</span>
              <span className="text-gray-400">•</span>
              <span className="truncate">{task.client}</span>
              {task.dueDate && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className={`font-medium ${
                    isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-600'
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
            
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded ${priorityInfo.badge}`}>
              <span className="text-xs">{priorityInfo.icon}</span>
            </span>
            
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
