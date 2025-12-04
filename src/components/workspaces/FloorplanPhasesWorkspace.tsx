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
  FileStack
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

  const getOverallStatus = () => {
    if (approvalStatus === 'COMPLETED') return { label: 'Approved', color: 'bg-[#14b8a6]' }
    if (approvalStatus === 'IN_PROGRESS') return { label: 'Awaiting Approval', color: 'bg-[#f6762e]' }
    if (drawingsStatus === 'IN_PROGRESS') return { label: 'Drawings In Progress', color: 'bg-[#6366ea]' }
    return { label: 'Not Started', color: 'bg-gray-400' }
  }

  const status = getOverallStatus()

  // Drawings always uses Indigo as base color
  const getDrawingsConfig = () => {
    const baseConfig = {
      gradient: 'from-indigo-50 to-blue-100',
      border: 'border-indigo-200 hover:border-indigo-300',
      iconBg: 'bg-[#6366ea]',
      titleColor: 'text-indigo-800',
      descColor: 'text-indigo-600',
    }
    
    if (revisionRequested) {
      return {
        ...baseConfig,
        gradient: 'from-amber-50 to-orange-100',
        border: 'border-amber-200 hover:border-amber-300',
        titleColor: 'text-amber-800',
        descColor: 'text-amber-600',
        statusBg: 'bg-amber-100',
        statusText: 'text-amber-700',
        statusLabel: 'Revision Needed'
      }
    }
    if (drawingsStatus === 'COMPLETED') {
      return {
        ...baseConfig,
        statusBg: 'bg-teal-100',
        statusText: 'text-teal-700',
        statusLabel: 'Completed'
      }
    }
    if (drawingsStatus === 'IN_PROGRESS') {
      return {
        ...baseConfig,
        statusBg: 'bg-indigo-100',
        statusText: 'text-indigo-700',
        statusLabel: 'In Progress'
      }
    }
    return {
      ...baseConfig,
      statusBg: 'bg-gray-100',
      statusText: 'text-gray-600',
      statusLabel: 'Not Started'
    }
  }

  // Approval always uses Purple as base color  
  const getApprovalConfig = () => {
    const baseConfig = {
      gradient: 'from-purple-50 to-violet-100',
      border: 'border-purple-200 hover:border-purple-300',
      iconBg: 'bg-[#a657f0]',
      titleColor: 'text-purple-800',
      descColor: 'text-purple-600',
    }
    
    if (approvalStatus === 'COMPLETED') {
      return {
        ...baseConfig,
        statusBg: 'bg-teal-100',
        statusText: 'text-teal-700',
        statusLabel: 'Approved'
      }
    }
    if (approvalStatus === 'IN_PROGRESS') {
      return {
        ...baseConfig,
        statusBg: 'bg-amber-100',
        statusText: 'text-amber-700',
        statusLabel: 'Awaiting Response'
      }
    }
    return {
      ...baseConfig,
      statusBg: 'bg-gray-100',
      statusText: 'text-gray-600',
      statusLabel: 'Not Started'
    }
  }

  const drawingsConfig = getDrawingsConfig()
  const approvalConfig = getApprovalConfig()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Button
            onClick={() => router.push(`/projects/${project.id}`)}
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          
          <h1 className="text-2xl font-bold text-gray-900">Floorplan</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{project.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.color}`} />
              <span>{status.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Phases</h2>
          <p className="text-sm text-gray-500 mt-1">Complete each phase to finalize the floorplan</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Phase 0: Client Sources */}
          <Link href={`/projects/${project.id}/floorplan/sources`} className="group block">
            <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-5 border border-amber-200 hover:border-amber-300 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-[#f6762e] rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <FileStack className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-amber-800">
                    Client Sources
                  </h3>
                  <p className="text-sm mt-0.5 text-amber-600">
                    Upload client files and documents
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                  sourcesCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {sourcesCount > 0 ? (
                    <>
                      <FolderOpen className="w-3 h-3 mr-1" />
                      {sourcesCount} {sourcesCount === 1 ? 'file' : 'files'}
                    </>
                  ) : (
                    'No files yet'
                  )}
                </span>
              </div>
            </div>
          </Link>

          {/* Phase 1: Floorplan Drawings */}
          <Link href={`/projects/${project.id}/floorplan/drawings`} className="group block">
            <div className={`bg-gradient-to-br ${drawingsConfig.gradient} rounded-xl p-5 border ${drawingsConfig.border} hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]`}>
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 ${drawingsConfig.iconBg} rounded-lg flex items-center justify-center shadow-sm flex-shrink-0`}>
                  {revisionRequested ? (
                    <AlertTriangle className="w-5 h-5 text-white" />
                  ) : (
                    <Pencil className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold ${drawingsConfig.titleColor}`}>
                    Floorplan Drawings
                  </h3>
                  <p className={`text-sm mt-0.5 ${drawingsConfig.descColor}`}>
                    Upload and manage floorplan drawings
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${drawingsConfig.statusBg} ${drawingsConfig.statusText}`}>
                  {revisionRequested && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {!revisionRequested && drawingsStatus === 'COMPLETED' && <Check className="w-3 h-3 mr-1" />}
                  {drawingsConfig.statusLabel}
                </span>
                {hasAssets && !revisionRequested && (
                  <span className={`text-xs ${drawingsConfig.descColor} flex items-center`}>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Files uploaded
                  </span>
                )}
              </div>
            </div>
          </Link>

          {/* Phase 2: Client Approval */}
          <Link href={`/projects/${project.id}/floorplan-approval`} className="group block">
            <div className={`bg-gradient-to-br ${approvalConfig.gradient} rounded-xl p-5 border ${approvalConfig.border} hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]`}>
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 ${approvalConfig.iconBg} rounded-lg flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold ${approvalConfig.titleColor}`}>
                    Client Approval
                  </h3>
                  <p className={`text-sm mt-0.5 ${approvalConfig.descColor}`}>
                    Send floorplans for client review
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${approvalConfig.statusBg} ${approvalConfig.statusText}`}>
                  {approvalStatus === 'COMPLETED' && <Check className="w-3 h-3 mr-1" />}
                  {approvalStatus === 'IN_PROGRESS' && <Clock className="w-3 h-3 mr-1" />}
                  {approvalConfig.statusLabel}
                </span>
                {approvalStatus === 'COMPLETED' && (
                  <span className="text-xs text-teal-600 font-medium flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Signed Off
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
