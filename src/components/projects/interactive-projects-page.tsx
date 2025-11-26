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
    startDate?: Date
    dueDate?: Date
    stages?: {
      id: string
      type: string
      status: string
      startDate?: Date
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
  const [sortBy, setSortBy] = useState<string>('created')
  
  // Generate unique subtle color based on project name
  const getProjectColor = (name: string) => {
    // Simple hash function to generate consistent colors from name
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    const colors = [
      { gradient: 'from-purple-50/50 via-pink-50/50 to-rose-50/50', border: 'border-purple-200' },
      { gradient: 'from-blue-50/50 via-cyan-50/50 to-teal-50/50', border: 'border-blue-200' },
      { gradient: 'from-violet-50/50 via-purple-50/50 to-fuchsia-50/50', border: 'border-violet-200' },
      { gradient: 'from-amber-50/50 via-orange-50/50 to-yellow-50/50', border: 'border-amber-200' },
      { gradient: 'from-emerald-50/50 via-teal-50/50 to-cyan-50/50', border: 'border-emerald-200' },
      { gradient: 'from-indigo-50/50 via-blue-50/50 to-sky-50/50', border: 'border-indigo-200' },
      { gradient: 'from-pink-50/50 via-rose-50/50 to-red-50/50', border: 'border-pink-200' },
      { gradient: 'from-lime-50/50 via-green-50/50 to-emerald-50/50', border: 'border-lime-200' },
      { gradient: 'from-fuchsia-50/50 via-purple-50/50 to-violet-50/50', border: 'border-fuchsia-200' },
      { gradient: 'from-orange-50/50 via-amber-50/50 to-rose-50/50', border: 'border-orange-200' }
    ]
    
    return colors[Math.abs(hash) % colors.length]
  }
  
  // Sort projects based on selected option
  const sortedProjects = [...projects].sort((a, b) => {
    switch (sortBy) {
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'updated':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      case 'progress':
        const getProgress = (project: Project) => {
          const completedStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.filter((stage: any) => stage.status === 'COMPLETED')?.length || 0)
          }, 0) || 0
          const totalStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.length || 0)
          }, 0) || 0
          return totalStages > 0 ? (completedStages / totalStages) * 100 : 0
        }
        return getProgress(b) - getProgress(a)
      default:
        return 0
    }
  })

  // Transform projects data into calendar tasks when in calendar view
  const getCalendarTasks = () => {
    const tasks: any[] = []
    
    projects.forEach(project => {
      project.rooms?.forEach(room => {
        room.stages?.forEach(stage => {
          const phaseTitle = stage.type === 'THREE_D' ? '3D Rendering' : 
                            stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
          
          // Add start date entry if exists
          if (stage.startDate && stage.status !== 'COMPLETED') {
            tasks.push({
              id: `${stage.id}-start`,
              title: `🚀 ${phaseTitle} Start - ${room.name || room.type.replace('_', ' ')}`,
              projectName: project.name,
              clientName: project.client.name,
              dueDate: stage.startDate.toISOString(),
              status: stage.status,
              type: 'stage' as const,
              stageType: stage.type,
              isStartDate: true,
              assignedUser: (stage as any).assignedUser ? {
                id: (stage as any).assignedUser.id,
                name: (stage as any).assignedUser.name
              } : undefined
            })
          }
          
          // Add due date entry if exists
          if (stage.dueDate && stage.status !== 'COMPLETED') {
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
              isStartDate: false,
              assignedUser: (stage as any).assignedUser ? {
                id: (stage as any).assignedUser.id,
                name: (stage as any).assignedUser.name
              } : undefined
            })
          }
        })
        
        // Add room-level start/due dates if they exist
        if (room.startDate) {
          tasks.push({
            id: `${room.id}-room-start`,
            title: `🏠 Room Start: ${room.name || room.type.replace('_', ' ')}`,
            projectName: project.name,
            clientName: project.client.name,
            dueDate: room.startDate.toISOString(),
            status: 'PENDING',
            type: 'stage' as const,
            stageType: 'ROOM_START',
            isStartDate: true
          })
        }
        if (room.dueDate) {
          tasks.push({
            id: `${room.id}-room-due`,
            title: `🏠 Room Due: ${room.name || room.type.replace('_', ' ')}`,
            projectName: project.name,
            clientName: project.client.name,
            dueDate: room.dueDate.toISOString(),
            status: 'PENDING',
            type: 'stage' as const,
            stageType: 'ROOM_DUE'
          })
        }
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
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="created">Date created</option>
            <option value="updated">Last updated</option>
            <option value="name">Name</option>
            <option value="dueDate">Due date</option>
            <option value="progress">Progress</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">{sortedProjects?.length || 0} projects</div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedProjects && sortedProjects.length > 0 && sortedProjects.map((project) => {
          const completedStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.filter((stage: any) => stage.status === 'COMPLETED')?.length || 0)
          }, 0) || 0
          const totalStages = project.rooms?.reduce((total: number, room: any) => {
            return total + (room.stages?.length || 0)
          }, 0) || 0
          const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
          
          // Get project status badge with colors
          const getProjectStatus = () => {
            const statusMap: Record<string, { name: string; color: string }> = {
              DRAFT: { name: 'Draft', color: 'bg-gray-100 text-gray-800 border border-gray-300' },
              IN_PROGRESS: { name: 'In Progress', color: 'bg-blue-100 text-blue-800 border border-blue-300' },
              ON_HOLD: { name: 'On Hold', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
              URGENT: { name: 'Urgent', color: 'bg-red-100 text-red-800 border border-red-300' },
              CANCELLED: { name: 'Cancelled', color: 'bg-gray-200 text-gray-700 border border-gray-400' },
              COMPLETED: { name: 'Completed', color: 'bg-green-100 text-green-800 border border-green-300' }
            }
            return statusMap[project.status] || { name: project.status, color: 'bg-gray-100 text-gray-800' }
          }
          
          const projectStatus = getProjectStatus()

          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="group">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col">
                {/* Project Thumbnail */}
                <div className="aspect-[16/9] relative overflow-hidden">
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
                      {/* Soft colored gradient base */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${getProjectColor(project.name).gradient}`} />
                      
                      {/* Building illustration - different for commercial vs residential */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.25]">
                        {project.type === 'COMMERCIAL' ? (
                          // Commercial building
                          <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
                            <g className="text-gray-700">
                              {/* Main building structure */}
                              <rect x="40" y="20" width="120" height="130" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              <rect x="42" y="22" width="116" height="126" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.3"/>
                              
                              {/* Windows grid - Floor 1 */}
                              <rect x="55" y="35" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="85" y="35" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="115" y="35" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              
                              {/* Windows grid - Floor 2 */}
                              <rect x="55" y="60" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="85" y="60" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="115" y="60" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              
                              {/* Windows grid - Floor 3 */}
                              <rect x="55" y="85" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="85" y="85" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="115" y="85" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              
                              {/* Windows grid - Floor 4 */}
                              <rect x="55" y="110" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="85" y="110" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <rect x="115" y="110" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                              
                              {/* Entrance */}
                              <rect x="85" y="135" width="30" height="15" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              <path d="M100 135 L100 150" stroke="currentColor" strokeWidth="1.5"/>
                              
                              {/* Decorative top */}
                              <path d="M40 20 L50 10 L150 10 L160 20" stroke="currentColor" strokeWidth="2" fill="none"/>
                            </g>
                          </svg>
                        ) : (
                          // Residential house
                          <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
                            <g className="text-gray-700">
                              {/* Main house structure with shadow effect */}
                              <path d="M20 85 L120 20 L220 85 L220 145 L20 145 Z" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.3"/>
                              <path d="M20 83 L120 18 L220 83 L220 143 L20 143 Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              
                              {/* Roof detail */}
                              <circle cx="120" cy="30" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <path d="M120 37 L120 45" stroke="currentColor" strokeWidth="2"/>
                              
                              {/* Door with arch */}
                              <path d="M100 110 L100 143 L140 143 L140 110 Q120 105 100 110 Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              <circle cx="133" cy="125" r="2.5" fill="currentColor"/>
                              <path d="M120 110 L120 143" stroke="currentColor" strokeWidth="1.5"/>
                              
                              {/* Windows - Left side */}
                              <rect x="40" y="90" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              <path d="M54 90 L54 118 M40 104 L68 104" stroke="currentColor" strokeWidth="1.5"/>
                              
                              {/* Windows - Right side */}
                              <rect x="172" y="90" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                              <path d="M186 90 L186 118 M172 104 L200 104" stroke="currentColor" strokeWidth="1.5"/>
                              
                              {/* Upper floor windows */}
                              <rect x="60" y="55" width="22" height="22" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <path d="M71 55 L71 77 M60 66 L82 66" stroke="currentColor" strokeWidth="1.2"/>
                              
                              <rect x="158" y="55" width="22" height="22" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <path d="M169 55 L169 77 M158 66 L180 66" stroke="currentColor" strokeWidth="1.2"/>
                              
                              {/* Decorative elements */}
                              <path d="M35 143 L35 150 M50 143 L50 150 M70 143 L70 150" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
                              <path d="M170 143 L170 150 M190 143 L190 150 M205 143 L205 150" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
                            </g>
                          </svg>
                        )}
                      </div>
                      
                      {/* Project name as watermark background */}
                      <div className="absolute inset-0 flex items-start justify-center pt-6 px-4">
                        <h3 className="text-gray-500 font-black text-3xl text-center line-clamp-2 tracking-tight uppercase opacity-40 leading-tight">
                          {project.name}
                        </h3>
                      </div>
                    </>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${projectStatus.color} backdrop-blur-sm shadow-sm`}>
                      {projectStatus.name}
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
      {(!sortedProjects || sortedProjects.length === 0) && (
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
        getCalendarTasks().length > 0 ? (
          <CalendarView 
            tasks={getCalendarTasks()} 
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <Calendar className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Tasks</h3>
            <p className="text-gray-600 mb-4">Add due dates to your project stages to see them on the calendar.</p>
            <Button asChild variant="outline">
              <Link href="/projects">
                View Projects
              </Link>
            </Button>
          </div>
        )
      )}
    </div>
  )
}
