'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Loader2, TrendingUp, Layers, Package, CheckCircle, Clock, AlertCircle, Target, Zap, AlertTriangle, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { TaskLevelView } from '@/components/reports/TaskLevelView'
import { FFEAnalyticsView } from '@/components/reports/FFEAnalyticsView'
import { TimeInvestmentView } from '@/components/reports/TimeInvestmentView'
import { AISummarySection } from '@/components/reports/AISummarySection'
import { PhaseProgressChart } from '@/components/reports/charts/PhaseProgressChart'
import { StatusDistributionChart } from '@/components/reports/charts/StatusDistributionChart'
import { StatCard } from '@/components/reports/ui/StatCard'
import { ProgressRing } from '@/components/reports/ui/ProgressRing'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

type TabType = 'overview' | 'phases' | 'ffe' | 'time'

interface Props {
  projectId: string
}

export function ProjectReportContent({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [filters, setFilters] = useState<{
    phases: string[]
    rooms: string[]
    statuses: string[]
  }>({ phases: [], rooms: [], statuses: [] })

  const { data, error, isLoading } = useSWR(
    `/api/reports/${projectId}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  )

  const project = data?.project

  // Get available rooms for filter
  const availableRooms = useMemo(() => {
    if (!project) return []
    
    const roomsMap = new Map<string, string>()
    Object.values(project.phases).forEach((phase: any) => {
      phase.rooms?.forEach((room: any) => {
        roomsMap.set(room.roomId, room.roomName)
      })
    })
    
    return Array.from(roomsMap.entries()).map(([id, name]) => ({ id, name }))
  }, [project])

  // Calculate overall stats
  const stats = useMemo(() => {
    if (!project) return null

    const totalTasks = Object.values(project.phases).reduce((sum: number, p: any) => sum + p.total, 0)
    const completedTasks = Object.values(project.phases).reduce((sum: number, p: any) => sum + p.completed, 0)
    const inProgressTasks = Object.values(project.phases).reduce((sum: number, p: any) => sum + p.inProgress, 0)
    const pendingTasks = Object.values(project.phases).reduce((sum: number, p: any) => sum + p.pending, 0)

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks
    }
  }, [project])

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: TrendingUp },
    { id: 'phases' as TabType, label: 'Phase Details', icon: Layers },
    { id: 'ffe' as TabType, label: 'FFE Analytics', icon: Package },
    { id: 'time' as TabType, label: 'Time Investment', icon: Timer }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#a657f0]" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-lg text-gray-600 mb-2">Failed to load project report</p>
        <Link href="/reports">
          <Button variant="outline">Back to Reports</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Back Button and Header */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Reports
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Client: {project.clientName}</span>
              <span>•</span>
              <span>{project.roomCount} rooms</span>
              <span>•</span>
              <span className="capitalize">{project.status.toLowerCase().replace('_', ' ')}</span>
            </div>
          </div>
          
          {/* Progress Circle */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="transform -rotate-90 w-24 h-24">
              <circle cx="48" cy="48" r="40" stroke="#E5E7EB" strokeWidth="6" fill="none" />
              <circle
                cx="48" cy="48" r="40"
                stroke={project.overallCompletion >= 75 ? "#10B981" : project.overallCompletion >= 50 ? "#3B82F6" : "#F59E0B"}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - project.overallCompletion / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{project.overallCompletion}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#a657f0] text-[#a657f0]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        {(activeTab === 'phases' || activeTab === 'rooms') && (
          <div className="lg:col-span-1">
            <ReportFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableRooms={availableRooms}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className={`${(activeTab === 'phases' || activeTab === 'rooms') ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Premium Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Tasks"
                  value={stats?.totalTasks || 0}
                  icon={Layers}
                  gradient="bg-[#a657f0]"
                  iconColor="text-[#a657f0]"
                  subtitle="Across all phases"
                />
                <StatCard
                  title="Completed"
                  value={stats?.completedTasks || 0}
                  icon={CheckCircle}
                  gradient="bg-[#14b8a6]"
                  iconColor="text-[#14b8a6]"
                  subtitle={`${stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% of total`}
                />
                <StatCard
                  title="In Progress"
                  value={stats?.inProgressTasks || 0}
                  icon={Zap}
                  gradient="bg-[#6366ea]"
                  iconColor="text-[#6366ea]"
                  subtitle="Active tasks"
                />
                <StatCard
                  title="Pending"
                  value={stats?.pendingTasks || 0}
                  icon={AlertTriangle}
                  gradient="bg-[#f6762e]"
                  iconColor="text-[#f6762e]"
                  subtitle="Awaiting action"
                />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Phase Progress Chart */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Phase Progress</h3>
                    <Target className="w-5 h-5 text-[#a657f0]" />
                  </div>
                  <PhaseProgressChart 
                    phases={Object.entries(project.phases)
                      .filter(([key, phase]: [string, any]) => {
                        const phaseLabels: Record<string, string> = {
                          DESIGN_CONCEPT: 'Design Concept',
                          THREE_D: '3D Rendering',
                          DRAWINGS: 'Drawings',
                          FFE: 'FFE'
                        }
                        return phaseLabels[key] && !(phase.total > 0 && phase.total === phase.notApplicable)
                      })
                      .map(([key, phase]: [string, any]) => {
                        const phaseLabels: Record<string, string> = {
                          DESIGN_CONCEPT: 'Design Concept',
                          THREE_D: '3D Rendering',
                          DRAWINGS: 'Drawings',
                          FFE: 'FFE'
                        }
                        
                        let completed = phase.completed
                        let total = phase.total - phase.notApplicable
                        let percentage = phase.percentage
                        
                        // Special handling for FFE
                        let inProgress = phase.inProgress
                        let pending = phase.pending
                        
                        if (key === 'FFE') {
                          const allItems = phase.tasks.flatMap((t: any) => t.ffeItems || [])
                          const completedItems = allItems.filter((i: any) => 
                            i.status === 'COMPLETED' || i.status === 'ORDERED' || i.status === 'DELIVERED'
                          ).length
                          const pendingItems = allItems.filter((i: any) => 
                            i.status === 'PENDING' || i.status === 'UNDECIDED' || i.status === 'NOT_STARTED'
                          ).length
                          const totalItems = allItems.length
                          
                          if (totalItems > 0) {
                            completed = completedItems
                            inProgress = 0 // FFE items don't have "in progress" status
                            pending = pendingItems
                            total = totalItems
                            percentage = Math.round((completedItems / totalItems) * 100)
                          }
                        }
                        
                        return {
                          name: phaseLabels[key],
                          completed,
                          inProgress,
                          pending,
                          total,
                          percentage
                        }
                      })}
                  />
                </div>

                {/* Status Distribution Chart */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Status Distribution</h3>
                    <BarChart3 className="w-5 h-5 text-[#a657f0]" />
                  </div>
                  <StatusDistributionChart
                    completed={stats?.completedTasks || 0}
                    inProgress={stats?.inProgressTasks || 0}
                    pending={stats?.pendingTasks || 0}
                  />
                </div>
              </div>

              {/* Quick Insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#a657f0]/5 rounded-lg p-5 border border-[#a657f0]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-[#a657f0]/10 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-[#a657f0]" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Overall Progress</h4>
                  </div>
                  <div className="flex items-center justify-between">
                    <ProgressRing 
                      percentage={project.overallCompletion} 
                      size={100} 
                      strokeWidth={8}
                      color="auto"
                      showLabel={true}
                    />
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Completion</p>
                      <p className="text-xl font-bold text-gray-900">{project.overallCompletion}%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#14b8a6]/5 rounded-lg p-5 border border-[#14b8a6]/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-[#14b8a6]/10 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-[#14b8a6]" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Tasks Completed</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-[#14b8a6]">{stats?.completedTasks}</p>
                      <p className="text-gray-600">/ {stats?.totalTasks}</p>
                    </div>
                    <div className="h-2 bg-[#14b8a6]/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#14b8a6] transition-all duration-500"
                        style={{ width: `${stats?.totalTasks ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#f6762e]/5 rounded-lg p-5 border border-[#f6762e]/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-[#f6762e]/10 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-[#f6762e]" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Needs Attention</h4>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-[#f6762e]">{stats?.pendingTasks}</p>
                    <p className="text-sm text-gray-600">Tasks pending action</p>
                    {stats?.pendingTasks && stats.pendingTasks > 0 && (
                      <button className="text-sm text-[#f6762e] hover:text-[#f6762e]/80 font-medium flex items-center gap-1">
                        View details →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              <AISummarySection projectId={project.id} projectName={project.name} />
            </div>
          )}

          {/* Phase Details Tab */}
          {activeTab === 'phases' && (
            <TaskLevelView phases={project.phases} filters={filters} />
          )}

          {/* FFE Analytics Tab */}
          {activeTab === 'ffe' && (
            <FFEAnalyticsView phases={project.phases} />
          )}

          {/* Time Investment Tab */}
          {activeTab === 'time' && (
            <TimeInvestmentView projectId={project.id} />
          )}
        </div>
      </div>
    </div>
  )
}
