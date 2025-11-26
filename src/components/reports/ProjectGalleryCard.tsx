'use client'

import { Building2, Calendar, User, ArrowRight } from 'lucide-react'
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
  project: ProjectReport
}

const PHASE_CONFIG = {
  DESIGN_CONCEPT: { label: 'Design', color: 'bg-purple-500' },
  THREE_D: { label: '3D Rendering', color: 'bg-orange-500' },
  DRAWINGS: { label: 'Drawings', color: 'bg-indigo-500' },
  FFE: { label: 'FFE', color: 'bg-pink-500' }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  ON_HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  URGENT: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-gray-200 text-gray-700 border-gray-400',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300'
}

export function ProjectGalleryCard({ project }: Props) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString()
  const statusLabel = project.status.replace('_', ' ')

  return (
    <Link href={`/reports/${project.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-200 overflow-hidden group cursor-pointer h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                {project.name}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{project.clientName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span>{project.roomCount} {project.roomCount === 1 ? 'room' : 'rooms'}</span>
                </div>
              </div>
            </div>
            
            {/* Circular Progress */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle cx="40" cy="40" r="36" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                <circle
                  cx="40" cy="40" r="36"
                  stroke={project.overallCompletion >= 75 ? "#10B981" : project.overallCompletion >= 50 ? "#3B82F6" : "#F59E0B"}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - project.overallCompletion / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{project.overallCompletion}%</span>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] || STATUS_COLORS.IN_PROGRESS}`}>
              {statusLabel}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              {updatedDate}
            </div>
          </div>
        </div>

        {/* Phase Progress Bars */}
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Phase Progress</span>
            <span className="text-xs text-gray-500">
              {Object.values(project.phases).reduce((sum, p) => sum + p.completed, 0)}/
              {Object.values(project.phases).reduce((sum, p) => sum + (p.total - p.notApplicable), 0)} completed
            </span>
          </div>
          
          {Object.entries(PHASE_CONFIG).map(([key, config]) => {
            const phase = project.phases[key]
            // Skip if phase doesn't exist or all tasks are marked as NOT_APPLICABLE
            if (!phase) return null
            if (phase.total > 0 && phase.total === phase.notApplicable) return null

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600">{config.label}</span>
                  <span className="text-gray-500">{phase.completed}/{phase.total - phase.notApplicable}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.color} transition-all duration-500`}
                    style={{ width: `${phase.percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">View full report</span>
            <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}
