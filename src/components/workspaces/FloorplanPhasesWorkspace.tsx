'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Send,
  Pencil,
  Check,
  Clock,
  AlertTriangle,
  FolderOpen,
  ChevronRight,
  File,
  Image as ImageIcon,
  FileText,
  BookOpen
} from 'lucide-react'
import Link from 'next/link'
import { WorkspaceTimerButton } from '@/components/timeline/WorkspaceTimerButton'

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
    if (approvalStatus === 'COMPLETED') return { label: 'Approved', color: 'bg-emerald-500', textColor: 'text-emerald-700' }
    if (approvalStatus === 'IN_PROGRESS') return { label: 'Awaiting Approval', color: 'bg-amber-500', textColor: 'text-amber-700' }
    if (drawingsStatus === 'IN_PROGRESS') return { label: 'Drawings In Progress', color: 'bg-blue-500', textColor: 'text-blue-700' }
    if (drawingsStatus === 'COMPLETED') return { label: 'Drawings Complete', color: 'bg-indigo-500', textColor: 'text-indigo-700' }
    return { label: 'Not Started', color: 'bg-gray-300', textColor: 'text-gray-500' }
  }

  const status = getOverallStatus()

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
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
            <WorkspaceTimerButton
              projectId={project.id}
              stageType="FLOORPLAN"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Phase Cards */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phase 1: Floorplan Drawings */}
            <Link href={`/projects/${project.id}/floorplan/drawings`} className="group block">
              <div className={`bg-white rounded-xl border p-5 transition-all duration-200 hover:shadow-md group-hover:scale-[1.01] ${
                revisionRequested 
                  ? 'border-amber-300 bg-amber-50/50' 
                  : drawingsStatus === 'COMPLETED'
                  ? 'border-emerald-200'
                  : drawingsStatus === 'IN_PROGRESS'
                  ? 'border-indigo-200'
                  : 'border-gray-200 hover:border-indigo-300'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${
                    revisionRequested ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}>
                    {revisionRequested ? (
                      <AlertTriangle className="w-5 h-5 text-white" />
                    ) : (
                      <Pencil className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Phase 1</span>
                      {drawingsStatus === 'COMPLETED' && !revisionRequested && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <h3 className={`font-semibold mt-0.5 ${
                      revisionRequested ? 'text-amber-800' : 'text-gray-900'
                    }`}>
                      Floorplan Drawings
                    </h3>
                    <p className={`text-sm mt-1 ${
                      revisionRequested ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {revisionRequested 
                        ? 'Client requested revisions' 
                        : 'Upload and manage floorplan drawings'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors mt-1" />
                </div>

                {/* Status badge */}
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    revisionRequested 
                      ? 'bg-amber-100 text-amber-700'
                      : drawingsStatus === 'COMPLETED' 
                      ? 'bg-emerald-100 text-emerald-700'
                      : drawingsStatus === 'IN_PROGRESS'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {revisionRequested && <AlertTriangle className="w-3 h-3" />}
                    {drawingsStatus === 'COMPLETED' && !revisionRequested && <Check className="w-3 h-3" />}
                    {drawingsStatus === 'IN_PROGRESS' && !revisionRequested && <Clock className="w-3 h-3" />}
                    {revisionRequested ? 'Revision Needed' : 
                     drawingsStatus === 'COMPLETED' ? 'Completed' : 
                     drawingsStatus === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                  </span>
                  {hasAssets && !revisionRequested && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <File className="w-3 h-3" />
                      Files uploaded
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Phase 2: Client Approval */}
            <Link href={`/projects/${project.id}/floorplan-approval`} className="group block">
              <div className={`bg-white rounded-xl border p-5 transition-all duration-200 hover:shadow-md group-hover:scale-[1.01] ${
                approvalStatus === 'COMPLETED'
                  ? 'border-emerald-200'
                  : approvalStatus === 'IN_PROGRESS'
                  ? 'border-purple-200'
                  : 'border-gray-200 hover:border-purple-300'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-violet-500">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Phase 2</span>
                      {approvalStatus === 'COMPLETED' && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-0.5">
                      Client Approval
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Send floorplans for client review and sign-off
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors mt-1" />
                </div>

                {/* Status badge */}
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    approvalStatus === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : approvalStatus === 'IN_PROGRESS'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {approvalStatus === 'COMPLETED' && <Check className="w-3 h-3" />}
                    {approvalStatus === 'IN_PROGRESS' && <Clock className="w-3 h-3" />}
                    {approvalStatus === 'COMPLETED' ? 'Approved' :
                     approvalStatus === 'IN_PROGRESS' ? 'Awaiting Response' : 'Not Started'}
                  </span>
                  {approvalStatus === 'COMPLETED' && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Signed Off
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Spec Book Builder Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Spec Book</h2>
              <p className="text-sm text-gray-500 mt-0.5">Generate professional spec books for clients</p>
            </div>
          </div>

          <Link href={`/projects/${project.id}/specs/builder`} className="group block">
            <div className="bg-white rounded-xl border border-gray-200 hover:border-teal-300 p-6 transition-all duration-200 hover:shadow-md">
              <div className="flex items-center gap-5">
                {/* Icon */}
                <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-teal-600" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                      Spec Book Builder
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Build and export professional PDF spec books with room details, renderings, and product specifications
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
