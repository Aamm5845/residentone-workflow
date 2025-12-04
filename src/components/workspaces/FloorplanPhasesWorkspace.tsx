'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Layers, 
  Send,
  Pencil,
  Check,
  Clock,
  AlertTriangle,
  FolderOpen,
  FileStack,
  ChevronRight,
  Circle
} from 'lucide-react'
import Link from 'next/link'

interface FloorplanPhasesWorkspaceProps {
  project: {
    id: string
    name: string
    client?: {
      id: string
      name: string
      email: string
    }
  }
  drawingsStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  approvalStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  sourcesCount?: number
  currentVersionId?: string
  hasAssets: boolean
  revisionRequested?: boolean
}

export function FloorplanPhasesWorkspace({
  project,
  drawingsStatus,
  approvalStatus,
  sourcesCount = 0,
  currentVersionId,
  hasAssets,
  revisionRequested = false
}: FloorplanPhasesWorkspaceProps) {
  const router = useRouter()

  // Calculate sources status based on count
  const sourcesStatus = sourcesCount > 0 ? 'HAS_FILES' : 'NO_FILES'

  const getOverallStatus = () => {
    if (approvalStatus === 'COMPLETED') return { label: 'Approved', color: 'bg-emerald-500', textColor: 'text-emerald-700' }
    if (approvalStatus === 'IN_PROGRESS') return { label: 'Awaiting Approval', color: 'bg-amber-500', textColor: 'text-amber-700' }
    if (drawingsStatus === 'IN_PROGRESS') return { label: 'Drawings In Progress', color: 'bg-blue-500', textColor: 'text-blue-700' }
    if (sourcesCount > 0) return { label: 'Sources Uploaded', color: 'bg-slate-400', textColor: 'text-slate-600' }
    return { label: 'Not Started', color: 'bg-gray-300', textColor: 'text-gray-500' }
  }

  const status = getOverallStatus()

  // Calculate overall progress
  const getProgress = () => {
    let completed = 0
    if (sourcesCount > 0) completed++
    if (drawingsStatus === 'COMPLETED') completed++
    if (approvalStatus === 'COMPLETED') completed++
    return Math.round((completed / 3) * 100)
  }

  const progress = getProgress()

  // Phase configurations with cleaner, softer colors
  const phases = [
    {
      id: 'sources',
      title: 'Client Sources',
      description: 'Upload client files and documents',
      href: `/projects/${project.id}/floorplan/sources`,
      icon: FileStack,
      accentColor: 'bg-orange-500',
      lightBg: 'bg-orange-50',
      borderColor: 'border-orange-200',
      hoverBorder: 'hover:border-orange-300',
      textColor: 'text-orange-700',
      status: sourcesStatus === 'HAS_FILES' ? 'completed' : 'pending',
      statusLabel: sourcesCount > 0 ? `${sourcesCount} ${sourcesCount === 1 ? 'file' : 'files'}` : 'No files yet',
      statusIcon: sourcesCount > 0 ? FolderOpen : null
    },
    {
      id: 'drawings',
      title: 'Floorplan Drawings',
      description: 'Upload and manage floorplan drawings',
      href: `/projects/${project.id}/floorplan/drawings`,
      icon: revisionRequested ? AlertTriangle : Pencil,
      accentColor: revisionRequested ? 'bg-amber-500' : 'bg-indigo-500',
      lightBg: revisionRequested ? 'bg-amber-50' : 'bg-indigo-50',
      borderColor: revisionRequested ? 'border-amber-200' : 'border-indigo-200',
      hoverBorder: revisionRequested ? 'hover:border-amber-300' : 'hover:border-indigo-300',
      textColor: revisionRequested ? 'text-amber-700' : 'text-indigo-700',
      status: revisionRequested ? 'revision' : drawingsStatus === 'COMPLETED' ? 'completed' : drawingsStatus === 'IN_PROGRESS' ? 'in_progress' : 'pending',
      statusLabel: revisionRequested ? 'Revision Needed' : drawingsStatus === 'COMPLETED' ? 'Completed' : drawingsStatus === 'IN_PROGRESS' ? 'In Progress' : 'Not Started',
      hasAssets
    },
    {
      id: 'approval',
      title: 'Client Approval',
      description: 'Send floorplans for client review',
      href: `/projects/${project.id}/floorplan-approval`,
      icon: Send,
      accentColor: 'bg-violet-500',
      lightBg: 'bg-violet-50',
      borderColor: 'border-violet-200',
      hoverBorder: 'hover:border-violet-300',
      textColor: 'text-violet-700',
      status: approvalStatus === 'COMPLETED' ? 'completed' : approvalStatus === 'IN_PROGRESS' ? 'in_progress' : 'pending',
      statusLabel: approvalStatus === 'COMPLETED' ? 'Approved' : approvalStatus === 'IN_PROGRESS' ? 'Awaiting Response' : 'Not Started'
    }
  ]

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700'
      case 'in_progress':
        return 'bg-blue-100 text-blue-700'
      case 'revision':
        return 'bg-amber-100 text-amber-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-3 h-3" />
      case 'in_progress':
        return <Clock className="w-3 h-3" />
      case 'revision':
        return <AlertTriangle className="w-3 h-3" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Button
            onClick={() => router.push(`/projects/${project.id}`)}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 -ml-2 mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Project
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Floorplan</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm text-gray-500">{project.name}</span>
                <span className="text-gray-300">•</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status.color}`} />
                  <span className={`text-sm font-medium ${status.textColor}`}>{status.label}</span>
                </div>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-semibold text-gray-900">{progress}%</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="4"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 1.76} 176`}
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phases Section */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">Workflow Phases</h2>
          <p className="text-sm text-gray-500 mt-0.5">Complete each phase to finalize the floorplan</p>
        </div>

        {/* Phase Cards */}
        <div className="space-y-3">
          {phases.map((phase, index) => {
            const Icon = phase.icon
            return (
              <Link key={phase.id} href={phase.href} className="group block">
                <div className={`bg-white rounded-xl border ${phase.borderColor} ${phase.hoverBorder} p-5 transition-all duration-200 hover:shadow-md group-hover:translate-x-1`}>
                  <div className="flex items-center gap-4">
                    {/* Phase Number & Icon */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                        {index + 1}
                      </div>
                      <div className={`w-11 h-11 ${phase.accentColor} rounded-xl flex items-center justify-center shadow-sm`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    {/* Phase Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 group-hover:text-gray-700">
                          {phase.title}
                        </h3>
                        {phase.status === 'completed' && (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="w-3 h-3 text-emerald-600" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {phase.description}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${getStatusBadgeStyles(phase.status)}`}>
                        {phase.statusIcon && <phase.statusIcon className="w-3 h-3" />}
                        {getStatusIcon(phase.status)}
                        {phase.statusLabel}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>

                  {/* Progress indicator line for active phase */}
                  {phase.status === 'in_progress' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full w-1/2 animate-pulse" />
                        </div>
                        <span className="text-xs text-gray-500">In progress</span>
                      </div>
                    </div>
                  )}

                  {/* Additional info for drawings phase */}
                  {phase.id === 'drawings' && phase.hasAssets && !revisionRequested && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                      <Check className="w-3.5 h-3.5" />
                      Files uploaded
                    </div>
                  )}

                  {/* Signed off indicator for approval */}
                  {phase.id === 'approval' && approvalStatus === 'COMPLETED' && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Signed Off by Client
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Phase Connection Visual */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
          <Circle className={`w-3 h-3 ${sourcesCount > 0 ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-200 text-gray-200'}`} />
          <div className={`w-16 h-0.5 ${sourcesCount > 0 ? 'bg-emerald-300' : 'bg-gray-200'}`} />
          <Circle className={`w-3 h-3 ${drawingsStatus === 'COMPLETED' ? 'fill-emerald-500 text-emerald-500' : drawingsStatus === 'IN_PROGRESS' ? 'fill-blue-500 text-blue-500' : 'fill-gray-200 text-gray-200'}`} />
          <div className={`w-16 h-0.5 ${drawingsStatus === 'COMPLETED' ? 'bg-emerald-300' : 'bg-gray-200'}`} />
          <Circle className={`w-3 h-3 ${approvalStatus === 'COMPLETED' ? 'fill-emerald-500 text-emerald-500' : approvalStatus === 'IN_PROGRESS' ? 'fill-amber-500 text-amber-500' : 'fill-gray-200 text-gray-200'}`} />
        </div>
      </div>
    </div>
  )
}
