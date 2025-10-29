'use client'

import { useState } from 'react'
import { Plus, Search, Filter, MoreVertical, Building, Calendar, List, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, getStatusColor, formatRoomType } from '@/lib/utils'
import { getPhaseUrgency } from '@/lib/validation/due-date-validation'
import Link from 'next/link'
import Image from 'next/image'
import CalendarView from '@/components/calendar/calendar-view'

type ViewMode = 'list' | 'board' | 'calendar'

interface Project {
  id: string
  name: string
  description?: string
  type: string
  status: string
  dueDate?: Date
  budget?: number
  coverImages?: string[]
  createdAt: Date
  updatedAt: Date
  client: {
    id: string
    name: string
    email?: string
  }
  rooms?: {
    id: string
    type: string
    name?: string
    stages?: {
      id: string
      type: string
      status: string
      dueDate?: Date
    }[]
  }[]
  _count?: {
    rooms: number
    assets: number
    approvals: number
  }
}

interface InteractiveProjectsPageProps {
  projects: Project[]
  statusFilter?: string
  timeframeFilter?: string
  currentUser?: {
    id: string
    name: string
    email: string
  }
}

export default function InteractiveProjectsPage({ 
  projects, 
  statusFilter, 
  timeframeFilter,
  currentUser 
}: InteractiveProjectsPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Transform projects data into calendar tasks when in calendar view
  const getCalendarTasks = () => {
    const tasks: any[] = []
    
    projects.forEach(project => {
      project.rooms?.forEach(room => {
        room.stages?.forEach(stage => {
          if (stage.dueDate && stage.status !== 'COMPLETED') {
            const phaseTitle = stage.type === 'THREE_D' ? '3D Rendering' : 
                              stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
            
            tasks.push({
              id: stage.id,
              title: `${phaseTitle} - ${room.name || room.type.replace('_', ' ')}`,
              projectName: project.name,
              clientName: project.client.name,
              dueDate: stage.dueDate.toISOString(),
              status: stage.status,
              type: 'stage' as const,
              stageType: stage.type,
              urgencyLevel: getPhaseUrgency(stage.dueDate, stage.status) as 'critical' | 'high' | 'medium' | 'low',
              assignedUser: (stage as any).assignedUser ? {
                id: (stage as any).assignedUser.id,
                name: (stage as any).assignedUser.name
              } : undefined
            })
          }
        })
      })
    })
    
    return tasks
  }

  const renderProjectsList = () => (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select className="text-sm border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            <option>Last updated</option>
            <option>Name</option>
            <option>Due date</option>
            <option>Progress</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">{projects?.length || 0} projects</div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects && projects.length > 0 && projects.map((project) => {
          const completedStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.filter((stage: any) => stage.status === 'COMPLETED')?.length || 0)
          }, 0) || 0
          const totalStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.length || 0)
          }, 0) || 0
          const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
          
          // Get current phase based on active stages
          const getCurrentPhase = () => {
            const activeStages = project.rooms?.flatMap((room: any) => 
              room.stages?.filter((stage: any) => stage.status === 'IN_PROGRESS') || []
            ) || []
            if (activeStages.some((stage: any) => stage.type === 'DESIGN')) return { name: '🎨 Design', color: 'bg-purple-100 text-purple-800' }
            if (activeStages.some((stage: any) => stage.type === 'THREE_D')) return { name: '🎥 3D Rendering', color: 'bg-blue-100 text-blue-800' }
            if (activeStages.some((stage: any) => stage.type === 'CLIENT_APPROVAL')) return { name: '👥 Client Review', color: 'bg-green-100 text-green-800' }
            if (activeStages.some((stage: any) => stage.type === 'DRAWINGS')) return { name: '📐 Drafting', color: 'bg-orange-100 text-orange-800' }
            if (activeStages.some((stage: any) => stage.type === 'FFE')) return { name: '🛋️ FFE', color: 'bg-indigo-100 text-indigo-800' }
            return { name: 'Planning', color: 'bg-gray-100 text-gray-800' }
          }
          
          const currentPhase = getCurrentPhase()

          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="group">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col">
                {/* Project Thumbnail */}
                <div className="aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                  {project.coverImages && Array.isArray(project.coverImages) && project.coverImages.length > 0 ? (
                    <Image
                      src={project.coverImages[0]}
                      alt={project.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building className="w-8 h-8 text-gray-300" />
                      </div>
                    </>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${currentPhase.color} backdrop-blur-sm`}>
                      {currentPhase.name}
                    </span>
                  </div>
                  {/* Progress Badge */}
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{progressPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Project Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">{project.client.name}</p>
                    </div>
                  </div>
                  
                  {/* Room Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {project.rooms?.slice(0, 3).map((room: any) => (
                      <span 
                        key={room.id}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                      >
                        {formatRoomType(room.type)}
                      </span>
                    )) || []}
                    {(project.rooms?.length || 0) > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        +{(project.rooms?.length || 0) - 3} more
                      </span>
                    )}
                  </div>
                  
                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                    <span>{project.rooms?.length || 0} room{(project.rooms?.length || 0) !== 1 ? 's' : ''}</span>
                    <span>Updated {formatDate(project.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Empty State */}
      {(!projects || projects.length === 0) && (
        <div className="col-span-full">
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first project.</p>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const renderProjectsBoard = () => (
    <div className="text-center py-12">
      <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Board View Coming Soon</h3>
      <p className="text-gray-600">The board view is under development.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {statusFilter === 'active' ? 'Active Projects' : 
             statusFilter === 'completed' && timeframeFilter === 'month' ? 'Completed This Month' :
             statusFilter === 'completed' ? 'Completed Projects' : 'My Projects'}
          </h1>
          <p className="text-gray-600 mt-1">
            {projects?.length || 0} {statusFilter === 'active' ? 'active' : statusFilter === 'completed' ? 'completed' : ''} projects
            {statusFilter === 'completed' && timeframeFilter === 'month' ? ' this month' : ''}
          </p>
          {(statusFilter || timeframeFilter) && (
            <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
              ← Back to Dashboard
            </Link>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
            <Link href="/projects/new">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${
              viewMode === 'list' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${
              viewMode === 'board' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Board
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${
              viewMode === 'calendar' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Calendar
          </button>
        </div>
      </div>

      {/* Content Based on View Mode */}
      {viewMode === 'list' && renderProjectsList()}
      {viewMode === 'board' && renderProjectsBoard()}
      {viewMode === 'calendar' && (
        <CalendarView 
          tasks={getCalendarTasks()} 
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
        />
      )}
    </div>
  )
}
