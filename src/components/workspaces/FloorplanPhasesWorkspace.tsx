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
  Sparkles,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

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

  // Calculate overall progress
  const completedPhases = [drawingsStatus, approvalStatus].filter(s => s === 'COMPLETED').length
  const progress = Math.round((completedPhases / 2) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Button
            onClick={() => router.push(`/projects/${project.id}`)}
            variant="ghost"
            size="sm"
            className="mb-5 -ml-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Layers className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 bg-clip-text text-transparent">
                  Floorplan
                </h1>
                <p className="text-sm text-indigo-600/70 mt-0.5">{project.name}</p>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center space-x-4 bg-white rounded-2xl px-5 py-3 shadow-md border border-indigo-100">
              <div className="text-right mr-2">
                <p className="text-lg font-bold text-indigo-700">{progress}%</p>
                <p className="text-xs text-indigo-500">{completedPhases} of 2 done</p>
              </div>
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="currentColor"
                    strokeWidth="5"
                    fill="none"
                    className="text-indigo-100"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="url(#progressGradient)"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 1.508} 150.8`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {completedPhases === 2 ? (
                    <Sparkles className="w-5 h-5 text-pink-500" />
                  ) : (
                    <span className="text-xs font-bold text-indigo-700">{completedPhases}/2</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phases Grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase 1: Floorplan Drawings */}
          <Link href={`/projects/${project.id}/floorplan/drawings`} className="group block">
            <div className={cn(
              "relative rounded-2xl border-2 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
              revisionRequested
                ? 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50'
                : drawingsStatus === 'COMPLETED' 
                ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50' 
                : 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/80'
            )}>
              <div className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
                    revisionRequested
                      ? 'bg-gradient-to-br from-red-500 to-orange-500'
                      : drawingsStatus === 'COMPLETED' 
                      ? 'bg-gradient-to-br from-emerald-500 to-green-500' 
                      : 'bg-gradient-to-br from-indigo-500 to-blue-500'
                  )}>
                    {revisionRequested ? (
                      <AlertTriangle className="w-6 h-6 text-white" />
                    ) : (
                      <Pencil className="w-6 h-6 text-white" />
                    )}
                  </div>
                  
                  {/* Phase Number */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                    revisionRequested
                      ? 'bg-red-500 text-white'
                      : drawingsStatus === 'COMPLETED' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-indigo-500 text-white'
                  )}>
                    {revisionRequested ? <AlertTriangle className="w-4 h-4" /> :
                     drawingsStatus === 'COMPLETED' ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                </div>

                {/* Content */}
                <h3 className={cn(
                  "text-xl font-bold mb-2",
                  revisionRequested ? 'text-red-700' :
                  drawingsStatus === 'COMPLETED' ? 'text-emerald-700' : 'text-indigo-800'
                )}>
                  Floorplan Drawings
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload and manage floorplan drawings, CAD files, and architectural documents.
                </p>

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold",
                    revisionRequested
                      ? 'bg-red-100 text-red-700'
                      : drawingsStatus === 'COMPLETED' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : drawingsStatus === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-indigo-100 text-indigo-700'
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full mr-2",
                      revisionRequested ? 'bg-red-500 animate-pulse' :
                      drawingsStatus === 'COMPLETED' ? 'bg-emerald-500' : 
                      drawingsStatus === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' : 
                      'bg-indigo-400'
                    )} />
                    {revisionRequested ? 'Revision Needed' :
                     drawingsStatus === 'COMPLETED' ? 'Completed' : 
                     drawingsStatus === 'IN_PROGRESS' ? 'In Progress' : 
                     'Ready to Start'}
                  </div>
                  {revisionRequested ? (
                    <span className="text-xs text-red-600 flex items-center font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Update Required
                    </span>
                  ) : hasAssets && (
                    <span className="text-xs text-emerald-600 flex items-center font-medium">
                      <FileCheck className="w-3.5 h-3.5 mr-1" />
                      Files uploaded
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  className={cn(
                    "w-full font-semibold shadow-md hover:shadow-lg transition-all",
                    revisionRequested
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : drawingsStatus === 'COMPLETED' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  )}
                >
                  {revisionRequested && <AlertTriangle className="w-4 h-4 mr-2" />}
                  {!revisionRequested && drawingsStatus === 'NOT_STARTED' && <Play className="w-4 h-4 mr-2" />}
                  {!revisionRequested && drawingsStatus === 'IN_PROGRESS' && <ArrowRight className="w-4 h-4 mr-2" />}
                  {!revisionRequested && drawingsStatus === 'COMPLETED' && <Check className="w-4 h-4 mr-2" />}
                  {revisionRequested ? 'Make Revisions' :
                   drawingsStatus === 'NOT_STARTED' ? 'Start Drawings' :
                   drawingsStatus === 'IN_PROGRESS' ? 'Continue Working' :
                   'View Drawings'}
                </Button>
              </div>
            </div>
          </Link>

          {/* Phase 2: Floorplan Approval */}
          <Link href={`/projects/${project.id}/floorplan-approval`} className="group block">
            <div className={cn(
              "relative rounded-2xl border-2 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
              approvalStatus === 'COMPLETED' 
                ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50' 
                : 'border-purple-200 bg-gradient-to-br from-white to-purple-50/80'
            )}>
              <div className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
                    approvalStatus === 'COMPLETED' 
                      ? 'bg-gradient-to-br from-emerald-500 to-green-500' 
                      : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  )}>
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Phase Number */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                    approvalStatus === 'COMPLETED' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-purple-500 text-white'
                  )}>
                    {approvalStatus === 'COMPLETED' ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                </div>

                {/* Content */}
                <h3 className={cn(
                  "text-xl font-bold mb-2",
                  approvalStatus === 'COMPLETED' ? 'text-emerald-700' : 'text-purple-800'
                )}>
                  Client Approval
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send floorplans to client for review, collect feedback, and manage approval.
                </p>

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold",
                    approvalStatus === 'COMPLETED' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : approvalStatus === 'IN_PROGRESS'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700'
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full mr-2",
                      approvalStatus === 'COMPLETED' ? 'bg-emerald-500' : 
                      approvalStatus === 'IN_PROGRESS' ? 'bg-amber-500 animate-pulse' : 
                      'bg-purple-400'
                    )} />
                    {approvalStatus === 'COMPLETED' ? 'Approved' : 
                     approvalStatus === 'IN_PROGRESS' ? 'Awaiting Response' : 
                     'Ready to Start'}
                  </div>
                  {approvalStatus === 'COMPLETED' && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Signed Off
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  className={cn(
                    "w-full font-semibold shadow-md hover:shadow-lg transition-all",
                    approvalStatus === 'COMPLETED' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  )}
                  disabled={drawingsStatus === 'NOT_STARTED'}
                >
                  {approvalStatus === 'NOT_STARTED' && <Play className="w-4 h-4 mr-2" />}
                  {approvalStatus === 'IN_PROGRESS' && <Clock className="w-4 h-4 mr-2" />}
                  {approvalStatus === 'COMPLETED' && <Check className="w-4 h-4 mr-2" />}
                  {approvalStatus === 'NOT_STARTED' ? 'Send for Approval' :
                   approvalStatus === 'IN_PROGRESS' ? 'View Status' :
                   'View Approval'}
                </Button>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

