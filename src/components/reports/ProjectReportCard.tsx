'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Building2, User } from 'lucide-react'
import { AISummarySection } from './AISummarySection'
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
  DESIGN_CONCEPT: { label: 'Design Concept', color: 'bg-[#a657f0]', lightColor: 'bg-[#a657f0]/10' },
  RENDERING: { label: '3D Rendering', color: 'bg-[#f6762e]', lightColor: 'bg-[#f6762e]/10' },
  CLIENT_APPROVAL: { label: 'Client Approval', color: 'bg-[#14b8a6]', lightColor: 'bg-[#14b8a6]/10' },
  DRAWINGS: { label: 'Drawings', color: 'bg-[#6366ea]', lightColor: 'bg-[#6366ea]/10' },
  FFE: { label: 'FFE', color: 'bg-[#e94d97]', lightColor: 'bg-[#e94d97]/10' }
}

export function ProjectReportCard({ project }: Props) {
  const [showAISummary, setShowAISummary] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const updatedDate = new Date(project.updatedAt).toLocaleDateString()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Link 
              href={`/projects/${project.id}`}
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {project.name}
            </Link>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {project.clientName}
              </div>
              <div className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {project.roomCount} {project.roomCount === 1 ? 'room' : 'rooms'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {project.overallCompletion}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Overall
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${project.overallCompletion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phase Progress Bars */}
      <div className="p-6 space-y-4">
        {Object.entries(PHASE_CONFIG).map(([key, config]) => {
          const phase = project.phases[key]
          if (!phase || phase.total === 0) return null

          const pendingCount = phase.pending
          const showPending = key === 'FFE' && pendingCount > 0

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{config.label}</span>
                  {showPending && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{phase.completed}/{phase.total - phase.notApplicable}</span>
                  <span className="font-semibold text-gray-900">{phase.percentage}%</span>
                </div>
              </div>
              <div className={`h-2 ${config.lightColor} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${config.color} transition-all duration-500`}
                  style={{ width: `${phase.percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Details Toggle */}
      {showDetails && (
        <div className="px-6 pb-4 space-y-3">
          {Object.entries(PHASE_CONFIG).map(([key, config]) => {
            const phase = project.phases[key]
            if (!phase || phase.total === 0) return null

            return (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <div className="font-medium text-sm text-gray-900 mb-2">{config.label}</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Completed</div>
                    <div className="font-semibold text-green-600">{phase.completed}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">In Progress</div>
                    <div className="font-semibold text-blue-600">{phase.inProgress}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Pending</div>
                    <div className="font-semibold text-gray-600">{phase.pending}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">N/A</div>
                    <div className="font-semibold text-slate-600">{phase.notApplicable}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* AI Summary Section */}
      {showAISummary && (
        <div className="px-6 pb-6">
          <AISummarySection projectId={project.id} projectName={project.name} />
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Updated {updatedDate}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Details
              </>
            )}
          </button>
          <span className="text-gray-300">•</span>
          <button
            onClick={() => setShowAISummary(!showAISummary)}
            className="text-sm text-[#a657f0] hover:text-[#a657f0]/80 flex items-center gap-1 font-medium transition-colors"
          >
            {showAISummary ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide AI Summary
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show AI Summary
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
