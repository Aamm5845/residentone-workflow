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
  Play,
  FileCheck,
  ArrowRight,
  AlertTriangle
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
  currentVersionId?: string
  hasAssets: boolean
  revisionRequested?: boolean
}

export function FloorplanPhasesWorkspace({
  project,
  drawingsStatus,
  approvalStatus,
  currentVersionId,
  hasAssets,
  revisionRequested = false
}: FloorplanPhasesWorkspaceProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push(`/projects/${project.id}`)}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </div>
          </div>
          
          {/* Title */}
          <div className="mt-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Floorplan</h1>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4" />
                <span className="font-medium">{project.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  approvalStatus === 'COMPLETED' ? 'bg-green-500' :
                  drawingsStatus === 'IN_PROGRESS' || approvalStatus === 'IN_PROGRESS' ? 'bg-blue-500' :
                  'bg-gray-400'
                }`} />
                <span className="font-medium">
                  {approvalStatus === 'COMPLETED' ? 'Approved' :
                   approvalStatus === 'IN_PROGRESS' ? 'Awaiting Approval' :
                   drawingsStatus === 'IN_PROGRESS' ? 'Drawings In Progress' :
                   'Not Started'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Phases</h2>
          <p className="text-gray-600 text-sm mt-1">Complete each phase to finalize the floorplan</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Phase 1: Floorplan Drawings */}
          <Link href={`/projects/${project.id}/floorplan/drawings`} className="group block">
            <div className={`rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02] ${
              revisionRequested 
                ? 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 hover:border-amber-300'
                : drawingsStatus === 'COMPLETED'
                ? 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 hover:border-green-300'
                : 'bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 hover:border-blue-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${
                    revisionRequested ? 'bg-amber-500' :
                    drawingsStatus === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {revisionRequested ? (
                      <AlertTriangle className="w-6 h-6 text-white" />
                    ) : (
                      <Pencil className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold transition-colors ${
                      revisionRequested ? 'text-amber-800 group-hover:text-amber-900' :
                      drawingsStatus === 'COMPLETED' ? 'text-green-800 group-hover:text-green-900' :
                      'text-blue-800 group-hover:text-blue-900'
                    }`}>
                      Floorplan Drawings
                    </h3>
                    <p className={`text-xs mt-1 ${
                      revisionRequested ? 'text-amber-600' :
                      drawingsStatus === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      Upload and manage floorplan drawings
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                  revisionRequested ? 'bg-amber-100 text-amber-700' :
                  drawingsStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  drawingsStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {revisionRequested && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {!revisionRequested && drawingsStatus === 'COMPLETED' && <Check className="w-3 h-3 mr-1" />}
                  {revisionRequested ? 'Revision Needed' :
                   drawingsStatus === 'COMPLETED' ? 'Completed' :
                   drawingsStatus === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                </span>
                {hasAssets && !revisionRequested && (
                  <span className="text-xs text-gray-500 flex items-center">
                    <FileCheck className="w-3.5 h-3.5 mr-1" />
                    Files uploaded
                  </span>
                )}
              </div>
            </div>
          </Link>

          {/* Phase 2: Client Approval */}
          <Link href={`/projects/${project.id}/floorplan-approval`} className="group block">
            <div className={`rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02] ${
              approvalStatus === 'COMPLETED'
                ? 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 hover:border-green-300'
                : 'bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 hover:border-purple-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${
                    approvalStatus === 'COMPLETED' ? 'bg-green-500' : 'bg-purple-500'
                  }`}>
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold transition-colors ${
                      approvalStatus === 'COMPLETED' ? 'text-green-800 group-hover:text-green-900' :
                      'text-purple-800 group-hover:text-purple-900'
                    }`}>
                      Client Approval
                    </h3>
                    <p className={`text-xs mt-1 ${
                      approvalStatus === 'COMPLETED' ? 'text-green-600' : 'text-purple-600'
                    }`}>
                      Send floorplans for client review
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                  approvalStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  approvalStatus === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {approvalStatus === 'COMPLETED' && <Check className="w-3 h-3 mr-1" />}
                  {approvalStatus === 'IN_PROGRESS' && <Clock className="w-3 h-3 mr-1" />}
                  {approvalStatus === 'COMPLETED' ? 'Approved' :
                   approvalStatus === 'IN_PROGRESS' ? 'Awaiting Response' : 'Not Started'}
                </span>
                {approvalStatus === 'COMPLETED' && (
                  <span className="text-xs text-green-600 font-medium flex items-center">
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
