'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown, ExternalLink, Eye } from 'lucide-react'
import Link from 'next/link'

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
}

interface ProjectReport {
  id: string
  name: string
  clientName: string
  status: string
  overallCompletion: number
  phases: Record<string, PhaseStats>
  roomCount: number
  updatedAt: string
}

interface Props {
  projects: ProjectReport[]
}

type SortField = 'name' | 'client' | 'completion' | 'rooms' | 'updated'
type SortDirection = 'asc' | 'desc'

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  DRAFT: 'bg-gray-100 text-gray-600'
}

export function ProjectsTableView({ projects }: Props) {
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const sortedProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) => {
      let aVal: any, bVal: any

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'client':
          aVal = a.clientName.toLowerCase()
          bVal = b.clientName.toLowerCase()
          break
        case 'completion':
          aVal = a.overallCompletion
          bVal = b.overallCompletion
          break
        case 'rooms':
          aVal = a.roomCount
          bVal = b.roomCount
          break
        case 'updated':
          aVal = new Date(a.updatedAt).getTime()
          bVal = new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [projects, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-indigo-600" />
      : <ChevronDown className="w-4 h-4 text-indigo-600" />
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3"></th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Project
                  <SortIcon field="name" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('client')}
              >
                <div className="flex items-center gap-2">
                  Client
                  <SortIcon field="client" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('completion')}
              >
                <div className="flex items-center gap-2">
                  Completion
                  <SortIcon field="completion" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('rooms')}
              >
                <div className="flex items-center gap-2">
                  Rooms
                  <SortIcon field="rooms" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phases
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('updated')}
              >
                <div className="flex items-center gap-2">
                  Updated
                  <SortIcon field="updated" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProjects.map((project) => (
              <>
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setExpandedRow(expandedRow === project.id ? null : project.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedRow === project.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4 transform rotate-180" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{project.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{project.clientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[project.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.DRAFT}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${project.overallCompletion}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{project.overallCompletion}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {project.roomCount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {Object.entries(project.phases).map(([key, phase]) => {
                        if (phase.total === 0) return null
                        const color = phase.percentage === 100 ? 'bg-green-500' : 
                                     phase.percentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                        return (
                          <div
                            key={key}
                            className={`w-2 h-6 rounded ${color}`}
                            title={`${key}: ${phase.percentage}%`}
                          />
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </td>
                </tr>
                {expandedRow === project.id && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 bg-gray-50">
                      <div className="grid grid-cols-5 gap-4">
                        {Object.entries(project.phases).map(([key, phase]) => {
                          if (phase.total === 0) return null
                          return (
                            <div key={key} className="bg-white p-4 rounded-lg border border-gray-200">
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                {key.replace('_', ' ')}
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Completed:</span>
                                  <span className="font-semibold text-green-600">{phase.completed}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">In Progress:</span>
                                  <span className="font-semibold text-blue-600">{phase.inProgress}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Pending:</span>
                                  <span className="font-semibold text-orange-600">{phase.pending}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">N/A:</span>
                                  <span className="font-semibold text-gray-400">{phase.notApplicable}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
