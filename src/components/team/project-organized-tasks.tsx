'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, CheckCircle, Play, AlertCircle, FolderOpen, Users, Building2, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Stage {
  id: string
  type: string
  status: string
  dueDate?: string | null
  room: {
    id: string
    name?: string
    type: string
    project: {
      id: string
      name: string
      client: {
        name: string
      }
    }
  }
}

interface ProjectTasksProps {
  member: {
    id: string
    name: string
    role: string
    assignedStages?: Stage[]
  }
  isExpanded?: boolean
}

interface ProjectGroup {
  projectId: string
  projectName: string
  clientName: string
  rooms: {
    roomId: string
    roomName: string
    roomType: string
    stages: Stage[]
  }[]
  totalStages: number
}

const STATUS_COLORS = {
  'NOT_STARTED': 'bg-gray-100 text-gray-700',
  'IN_PROGRESS': 'bg-blue-100 text-blue-700', 
  'COMPLETED': 'bg-green-100 text-green-700',
  'ON_HOLD': 'bg-yellow-100 text-yellow-700',
  'NEEDS_ATTENTION': 'bg-red-100 text-red-700',
  'PENDING_APPROVAL': 'bg-orange-100 text-orange-700'
}

const STATUS_ICONS = {
  'NOT_STARTED': Clock,
  'IN_PROGRESS': Play,
  'COMPLETED': CheckCircle,
  'ON_HOLD': Clock,
  'NEEDS_ATTENTION': AlertCircle,
  'PENDING_APPROVAL': Clock
}

const STAGE_TYPE_NAMES = {
  'DESIGN_CONCEPT': 'Design Concept',
  'DESIGN': 'Design Development',
  'THREE_D': '3D Rendering',
  'CLIENT_APPROVAL': 'Client Approval',
  'DRAWINGS': 'Technical Drawings',
  'FFE': 'FFE Sourcing'
}

function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return ''
  
  const date = new Date(dueDate)
  if (isNaN(date.getTime())) return ''
  
  const today = new Date()
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays <= 7) return `Due in ${diffDays} days`
  return date.toLocaleDateString()
}

function organizeTasksByProject(stages: Stage[]): ProjectGroup[] {
  const projectMap = new Map<string, ProjectGroup>()
  
  stages.forEach(stage => {
    const projectId = stage.room.project.id
    const roomId = stage.room.id
    
    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        projectId,
        projectName: stage.room.project.name,
        clientName: stage.room.project.client.name || '',
        rooms: [],
        totalStages: 0
      })
    }
    
    const project = projectMap.get(projectId)!
    let room = project.rooms.find(r => r.roomId === roomId)
    
    if (!room) {
      room = {
        roomId,
        roomName: stage.room.name || stage.room.type,
        roomType: stage.room.type,
        stages: []
      }
      project.rooms.push(room)
    }
    
    room.stages.push(stage)
    project.totalStages++
  })
  
  // Sort projects by name and rooms by name
  return Array.from(projectMap.values())
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
    .map(project => ({
      ...project,
      rooms: project.rooms.sort((a, b) => a.roomName.localeCompare(b.roomName))
    }))
}

export default function ProjectOrganizedTasks({ member, isExpanded = false }: ProjectTasksProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    isExpanded ? new Set(member.assignedStages?.map(s => s.room.project.id) || []) : new Set()
  )
  
  if (!member.assignedStages || member.assignedStages.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <Layers3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No active tasks</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      </div>
    )
  }

  const projectGroups = organizeTasksByProject(member.assignedStages)
  
  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }
  
  const totalTasks = member.assignedStages.length
  const inProgressTasks = member.assignedStages.filter(s => s.status === 'IN_PROGRESS').length
  const overdueTasks = member.assignedStages.filter(s => 
    s.dueDate && new Date(s.dueDate) < new Date()
  ).length

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {member.name}'s Tasks
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {totalTasks} total task{totalTasks !== 1 ? 's' : ''} across {projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1 text-blue-600">
              <Play className="w-4 h-4" />
              <span>{inProgressTasks} active</span>
            </div>
            {overdueTasks > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{overdueTasks} overdue</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Groups */}
      <div className="divide-y divide-gray-200">
        {projectGroups.map((project) => {
          const isProjectExpanded = expandedProjects.has(project.projectId)
          const projectInProgress = project.rooms.flatMap(r => r.stages)
            .filter(s => s.status === 'IN_PROGRESS').length
          const projectOverdue = project.rooms.flatMap(r => r.stages)
            .filter(s => s.dueDate && new Date(s.dueDate) < new Date()).length
          
          return (
            <div key={project.projectId}>
              {/* Project Header */}
              <div 
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => toggleProject(project.projectId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {isProjectExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-purple-500" />
                      <div>
                        <h4 className="font-medium text-gray-900">{project.projectName}</h4>
                        {project.clientName && (
                          <p className="text-sm text-gray-500">{project.clientName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                      {project.totalStages} task{project.totalStages !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center space-x-3">
                      {projectInProgress > 0 && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          <Play className="w-3 h-3 mr-1" />
                          {projectInProgress}
                        </span>
                      )}
                      {projectOverdue > 0 && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {projectOverdue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Content */}
              {isProjectExpanded && (
                <div className="px-6 pb-4 bg-gray-50">
                  <div className="space-y-3">
                    {project.rooms.map((room) => (
                      <div key={room.roomId} className="bg-white rounded-lg border border-gray-200 p-4">
                        {/* Room Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-indigo-500" />
                            <h5 className="font-medium text-gray-900">{room.roomName}</h5>
                            <span className="text-sm text-gray-500">({room.roomType})</span>
                          </div>
                          <Link 
                            href={`/projects/${project.projectId}/rooms/${room.roomId}`}
                            className="text-sm text-purple-600 hover:text-purple-800"
                          >
                            View Room →
                          </Link>
                        </div>
                        
                        {/* Room Stages */}
                        <div className="space-y-2">
                          {room.stages.map((stage) => {
                            const StatusIcon = STATUS_ICONS[stage.status as keyof typeof STATUS_ICONS] || Clock
                            const statusColor = STATUS_COLORS[stage.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.NOT_STARTED
                            const stageName = STAGE_TYPE_NAMES[stage.type as keyof typeof STAGE_TYPE_NAMES] || stage.type
                            const dueText = formatDueDate(stage.dueDate)
                            const isOverdue = stage.dueDate && new Date(stage.dueDate) < new Date()
                            
                            return (
                              <div key={stage.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-gray-50">
                                <div className="flex items-center space-x-3">
                                  <StatusIcon className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-900">{stageName}</span>
                                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                                    {stage.status.replace('_', ' ').toLowerCase()}
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  {dueText && (
                                    <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                      {dueText}
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(`/stages/${stage.id}`, '_blank')}
                                    className="text-xs"
                                  >
                                    Open
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Click on projects to view detailed tasks</span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setExpandedProjects(
              expandedProjects.size === projectGroups.length 
                ? new Set() 
                : new Set(projectGroups.map(p => p.projectId))
            )}
          >
            {expandedProjects.size === projectGroups.length ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>
      </div>
    </div>
  )
}
