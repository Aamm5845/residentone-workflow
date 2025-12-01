'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Clock, CheckCircle, AlertCircle, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface Stage {
  id: string
  type: string
  status: string
  order: number
  dueDate: Date | null
  updatedAt: Date
  room: {
    id: string
    name: string | null
    type: string
    project: {
      id: string
      name: string
      client: {
        name: string
      }
    }
  }
  assignedUser: {
    id: string
    name: string
    email: string
  } | null
}

interface InteractiveStagesPageProps {
  stages: Stage[]
  statusFilter?: string
}

export default function InteractiveStagesPage({ stages, statusFilter }: InteractiveStagesPageProps) {
  const router = useRouter()
  const [showFilters, setShowFilters] = useState(false)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [stageTypeFilter, setStageTypeFilter] = useState<string>('all')

  // Get unique projects, assignees, and stage types
  const projects = useMemo(() => {
    const projectMap = new Map()
    stages.forEach(stage => {
      if (!projectMap.has(stage.room.project.id)) {
        projectMap.set(stage.room.project.id, stage.room.project.name)
      }
    })
    return Array.from(projectMap.entries()).map(([id, name]) => ({ id, name }))
  }, [stages])

  const assignees = useMemo(() => {
    const assigneeMap = new Map()
    stages.forEach(stage => {
      if (stage.assignedUser && !assigneeMap.has(stage.assignedUser.id)) {
        assigneeMap.set(stage.assignedUser.id, stage.assignedUser.name)
      }
    })
    return Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name }))
  }, [stages])

  const stageTypes = useMemo(() => {
    const types = new Set<string>()
    stages.forEach(stage => types.add(stage.type))
    return Array.from(types).sort()
  }, [stages])

  // Filter stages
  const filteredStages = useMemo(() => {
    return stages.filter(stage => {
      if (projectFilter !== 'all' && stage.room.project.id !== projectFilter) return false
      if (assigneeFilter !== 'all' && (!stage.assignedUser || stage.assignedUser.id !== assigneeFilter)) return false
      if (stageTypeFilter !== 'all' && stage.type !== stageTypeFilter) return false
      return true
    })
  }, [stages, projectFilter, assigneeFilter, stageTypeFilter])

  const clearFilters = () => {
    setProjectFilter('all')
    setAssigneeFilter('all')
    setStageTypeFilter('all')
  }

  const hasActiveFilters = projectFilter !== 'all' || assigneeFilter !== 'all' || stageTypeFilter !== 'all'

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'NEEDS_ATTENTION':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'NEEDS_ATTENTION':
        return 'bg-red-100 text-red-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStageType = (type: string) => {
    switch (type) {
      case 'THREE_D':
        return '3D Rendering'
      case 'DESIGN_CONCEPT':
      case 'DESIGN':
        return 'Design Concept'
      case 'CLIENT_APPROVAL':
        return 'Client Approval'
      case 'DRAWINGS':
        return 'Drawings'
      case 'FFE':
        return 'FFE'
      default:
        return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="flex items-center space-x-3">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'bg-purple-50 border-purple-300' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter {hasActiveFilters && `(${[projectFilter !== 'all', assigneeFilter !== 'all', stageTypeFilter !== 'all'].filter(Boolean).length})`}
        </Button>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={clearFilters}
            className="text-gray-600"
          >
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project
              </label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Team Members</option>
                {assignees.map(assignee => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage Type
              </label>
              <select
                value={stageTypeFilter}
                onChange={(e) => setStageTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Stage Types</option>
                {stageTypes.map(type => (
                  <option key={type} value={type}>
                    {formatStageType(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-sm text-gray-600">
          Showing {filteredStages.length} of {stages.length} stages
        </div>
      )}

      {/* Stages List */}
      {filteredStages.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room & Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStages.map((stage) => (
                    <tr 
                      key={stage.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/stages/${stage.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(stage.status)}
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {formatStageType(stage.type)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Stage {stage.order || 1}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {stage.room.name || stage.room.type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {stage.room.project.name} • {stage.room.project.client.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(stage.status)}`}>
                          {stage.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stage.assignedUser ? (
                          <div className="flex items-center">
                            <Users className="w-4 h-4 text-gray-400 mr-2" />
                            {stage.assignedUser.name}
                          </div>
                        ) : (
                          <span className="text-gray-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stage.dueDate ? formatDate(stage.dueDate) : 'No due date'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(stage.updatedAt)}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <Clock className="w-full h-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter === 'active' ? 'No active stages' :
             statusFilter === 'overdue' ? 'No overdue stages' :
             statusFilter === 'pending' ? 'No pending stages' :
             statusFilter === 'completed' ? 'No completed stages' : 'No stages found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {hasActiveFilters ? 'Try adjusting your filters' : 
             statusFilter === 'active' ? 'All stages are completed or on hold.' :
             statusFilter === 'overdue' ? 'Great! No stages are past their due date.' :
             statusFilter === 'pending' ? 'No stages are waiting to be started or approved.' :
             statusFilter === 'completed' ? 'No stages have been completed yet.' :
             'Stages will appear here as projects are created.'}
          </p>
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
