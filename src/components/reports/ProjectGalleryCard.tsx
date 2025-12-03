'use client'

import { Building2, Calendar, User, ArrowRight, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

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
  coverImage?: string | null
}

interface Props {
  project: ProjectReport
}

const PHASE_CONFIG = {
  DESIGN_CONCEPT: { label: 'Design', color: 'bg-[#a657f0]' },
  THREE_D: { label: '3D', color: 'bg-[#f6762e]' },
  DRAWINGS: { label: 'Drawings', color: 'bg-[#6366ea]' },
  FFE: { label: 'FFE', color: 'bg-[#e94d97]' }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-[#6366ea]/10 text-[#6366ea]',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  COMPLETED: 'bg-[#14b8a6]/10 text-[#14b8a6]'
}

export function ProjectGalleryCard({ project }: Props) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString()
  const statusLabel = project.status.replace('_', ' ')

  // Get progress ring color based on completion
  const getProgressColor = () => {
    if (project.overallCompletion >= 75) return '#14b8a6' // teal
    if (project.overallCompletion >= 50) return '#6366ea' // indigo  
    if (project.overallCompletion >= 25) return '#f6762e' // orange
    return '#a657f0' // purple
  }

  return (
    <Link href={`/reports/${project.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 hover:border-[#a657f0]/40 hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer h-full">
        {/* Project Image / Progress Header */}
        <div className="relative h-24 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-between px-4">
          {/* Left: Project Image or Placeholder */}
          <div className="flex items-center gap-3">
            {project.coverImage ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                <Image
                  src={project.coverImage}
                  alt={project.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#a657f0]/10 to-[#6366ea]/10 flex items-center justify-center flex-shrink-0 border border-gray-200">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#a657f0] transition-colors line-clamp-1">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{project.clientName}</span>
              </div>
            </div>
          </div>
          
          {/* Right: Circular Progress */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="transform -rotate-90 w-14 h-14">
              <circle cx="28" cy="28" r="24" stroke="#E5E7EB" strokeWidth="4" fill="none" />
              <circle
                cx="28" cy="28" r="24"
                stroke={getProgressColor()}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - project.overallCompletion / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900">{project.overallCompletion}%</span>
            </div>
          </div>
        </div>

        {/* Status & Info Row */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.IN_PROGRESS}`}>
            {statusLabel}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              <span>{project.roomCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{updatedDate}</span>
            </div>
          </div>
        </div>

        {/* Phase Progress - Compact */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Phase Progress</span>
            <span className="text-xs text-gray-400">
              {Object.values(project.phases).reduce((sum, p) => sum + p.completed, 0)}/
              {Object.values(project.phases).reduce((sum, p) => sum + (p.total - p.notApplicable), 0)} completed
            </span>
          </div>
          
          {/* Stacked progress bars */}
          <div className="space-y-1.5">
            {Object.entries(PHASE_CONFIG).map(([key, config]) => {
              const phase = project.phases[key]
              if (!phase) return null
              if (phase.total > 0 && phase.total === phase.notApplicable) return null

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-500 w-14 truncate">{config.label}</span>
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.color} transition-all duration-500`}
                      style={{ width: `${phase.percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-8 text-right">{phase.completed}/{phase.total - phase.notApplicable}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50/50 flex items-center justify-end">
          <div className="flex items-center gap-1 text-xs text-[#a657f0] font-medium group-hover:gap-2 transition-all">
            <span>View full report</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}
