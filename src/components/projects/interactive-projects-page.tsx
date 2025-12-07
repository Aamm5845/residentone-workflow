'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Filter, MoreVertical, Building, List, LayoutGrid, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, getStatusColor, formatRoomType } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
type ViewMode = 'list' | 'board'

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
  const [showFilters, setShowFilters] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false)
      }
    }

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilters])
  
  // Subtle, mature color tints for project backgrounds
  const getProjectTint = (name: string) => {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    // Sophisticated muted tones - warm neutrals and subtle earth tones
    const tints = [
      'bg-stone-100/60',      // Warm grey
      'bg-zinc-100/60',       // Cool grey  
      'bg-slate-100/60',      // Blue-grey
      'bg-neutral-100/60',    // Pure neutral
      'bg-amber-50/40',       // Warm cream
      'bg-rose-50/30',        // Blush
      'bg-sky-50/30',         // Soft blue
      'bg-emerald-50/25',     // Sage
    ]
    
    return tints[Math.abs(hash) % tints.length]
  }

  // Filter projects based on selected filters
  const filteredProjects = projects.filter(project => {
    // Status filter
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(project.status)) {
      return false
    }
    // Type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes(project.type)) {
      return false
    }
    return true
  })

  // Helper function to calculate project progress using the 5-phase display system
  // This matches the room progress calculation in the project detail page
  const calculateProjectProgress = (project: Project) => {
    const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    
    let totalApplicablePhases = 0
    let completedPhases = 0
    
    project.rooms?.forEach((room: any) => {
      phaseIds.forEach(phaseId => {
        let matchingStage = null
        
        if (phaseId === 'DESIGN_CONCEPT') {
          // For DESIGN_CONCEPT, check both DESIGN and DESIGN_CONCEPT stages
          const designStage = room.stages?.find((stage: any) => stage.type === 'DESIGN')
          const designConceptStage = room.stages?.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
          matchingStage = designConceptStage || designStage
        } else {
          matchingStage = room.stages?.find((stage: any) => stage.type === phaseId)
        }
        
        // Skip phases marked as not applicable
        if (matchingStage?.status === 'NOT_APPLICABLE') {
          return
        }
        
        totalApplicablePhases++
        
        if (phaseId === 'DESIGN_CONCEPT') {
          // For DESIGN_CONCEPT phase, check if either DESIGN or DESIGN_CONCEPT is completed
          const designStage = room.stages?.find((stage: any) => stage.type === 'DESIGN')
          const designConceptStage = room.stages?.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
          
          if (designConceptStage?.status === 'COMPLETED' || designStage?.status === 'COMPLETED') {
            completedPhases++
          }
        } else {
          if (matchingStage?.status === 'COMPLETED') {
            completedPhases++
          }
        }
      })
    })
    
    return totalApplicablePhases > 0 ? Math.round((completedPhases / totalApplicablePhases) * 100) : 0
  }

  // Sort projects based on selected option
  const sortedProjects = [...filteredProjects].sort((a, b) => {
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
        return calculateProjectProgress(b) - calculateProjectProgress(a)
      default:
        return 0
    }
  })

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
          // Use the 5-phase display system for consistent progress calculation
          const progressPercent = calculateProjectProgress(project)
          
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
                    <div className="absolute inset-0">
                      {/* Grayscale interior design background */}
                      <Image
                        src="/default-project-cover.jpg"
                        alt="Interior design"
                        fill
                        className="object-cover grayscale opacity-30"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                      {/* Subtle color tint - unique per project */}
                      <div className={`absolute inset-0 ${getProjectTint(project.name)}`} />
                      {/* Light overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/40" />
                      {/* Project name overlay */}
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <h3 className="text-gray-700 font-semibold text-lg text-center leading-tight drop-shadow-sm">
                          {project.name}
                        </h3>
                      </div>
                    </div>
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
                            className="bg-[#a657f0] h-1.5 rounded-full transition-all duration-500" 
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
            {statusFilter === 'IN_PROGRESS' || statusFilter === 'active' ? 'Active Projects' : 
             (statusFilter === 'completed' || statusFilter === 'COMPLETED') && timeframeFilter === 'month' ? 'Completed This Month' :
             statusFilter === 'completed' || statusFilter === 'COMPLETED' ? 'Completed Projects' :
             statusFilter === 'DRAFT' ? 'Draft Projects' :
             statusFilter === 'ON_HOLD' ? 'On Hold Projects' : 'My Projects'}
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredProjects?.length || 0} of {projects?.length || 0} projects
            {(selectedStatuses.length > 0 || selectedTypes.length > 0) && ' (filtered)'}
          </p>
          {(statusFilter || timeframeFilter) && (
            <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
              ← Back to Dashboard
            </Link>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative" ref={filterDropdownRef}>
            <Button
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={selectedStatuses.length + selectedTypes.length > 0 ? 'border-purple-500 bg-purple-50' : ''}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
              {(selectedStatuses.length + selectedTypes.length > 0) && (
                <span className="ml-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {selectedStatuses.length + selectedTypes.length}
                </span>
              )}
            </Button>
            
            {/* Filter Dropdown */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    {(selectedStatuses.length + selectedTypes.length > 0) && (
                      <button
                        onClick={() => {
                          setSelectedStatuses([])
                          setSelectedTypes([])
                        }}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                    <div className="space-y-2">
                      {[
                        { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
                        { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
                        { value: 'ON_HOLD', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
                        { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-800' },
                        { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-200 text-gray-700' },
                        { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-800' }
                      ].map(status => (
                        <label key={status.value} className="flex items-center cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status.value])
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status.value))
                              }
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Type Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Project Type</label>
                    <div className="space-y-2">
                      {[
                        { value: 'RESIDENTIAL', label: 'Residential' },
                        { value: 'COMMERCIAL', label: 'Commercial' },
                        { value: 'HOSPITALITY', label: 'Hospitality' }
                      ].map(type => (
                        <label key={type.value} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTypes.includes(type.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTypes([...selectedTypes, type.value])
                              } else {
                                setSelectedTypes(selectedTypes.filter(t => t !== type.value))
                              }
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {type.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Apply Button */}
                  <div className="pt-3 border-t border-gray-200">
                    <Button
                      onClick={() => setShowFilters(false)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
            <Link href="/projects/new">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {(selectedStatuses.length > 0 || selectedTypes.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Active filters:</span>
          {selectedStatuses.map(status => {
            const statusMap: Record<string, string> = {
              DRAFT: 'Draft',
              IN_PROGRESS: 'In Progress',
              ON_HOLD: 'On Hold',
              URGENT: 'Urgent',
              CANCELLED: 'Cancelled',
              COMPLETED: 'Completed'
            }
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full"
              >
                {statusMap[status]}
                <button
                  onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
          {selectedTypes.map(type => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full"
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
              <button
                onClick={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}
                className="hover:bg-indigo-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

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
        </div>
      </div>

      {/* Content Based on View Mode */}
      {viewMode === 'list' && renderProjectsList()}
      {viewMode === 'board' && renderProjectsBoard()}
    </div>
  )
}
