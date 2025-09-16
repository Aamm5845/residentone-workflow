'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Palette,
  Box,
  CheckSquare,
  FileText,
  CheckCircle,
  Clock,
  Users
} from 'lucide-react'

interface WorkflowProgressProps {
  projectId: string
  stageStats: {
    design: { complete: number, inProgress: number, notStarted: number }
    threeD: { complete: number, inProgress: number, notStarted: number }
    clientApproval: { complete: number, inProgress: number, notStarted: number }
    drawings: { complete: number, inProgress: number, notStarted: number }
    ffe: { complete: number, inProgress: number, notStarted: number }
  }
  rooms: any[]
}

export default function WorkflowProgress({ projectId, stageStats, rooms }: WorkflowProgressProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  // Get stages of specific status for navigation
  const getStagesWithStatus = (stageType: string, status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED') => {
    return rooms.flatMap(room => 
      room.stages
        .filter((stage: any) => stage.type === stageType && stage.status === status)
        .map((stage: any) => ({
          ...stage,
          roomName: room.name || room.type.replace('_', ' '),
          roomId: room.id
        }))
    )
  }

  const handleStatusClick = (stageType: string, status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED') => {
    const stages = getStagesWithStatus(stageType, status)
    if (stages.length === 1) {
      // Navigate directly to the stage
      window.open(`/stages/${stages[0].id}`, '_blank')
    } else if (stages.length > 1) {
      // Show modal or dropdown with options
      setSelectedStage(`${stageType}_${status}`)
    }
  }

  const StageStatusItem = ({ 
    label, 
    count, 
    color, 
    stageType, 
    status 
  }: { 
    label: string
    count: number
    color: string
    stageType: string
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'
  }) => {
    const stages = getStagesWithStatus(stageType, status)
    const isClickable = count > 0

    if (!isClickable) {
      return (
        <p className={`text-sm ${color} opacity-50`}>
          {label} {count}
        </p>
      )
    }

    return (
      <div className="relative">
        <button
          onClick={() => handleStatusClick(stageType, status)}
          className={`text-sm ${color} hover:underline cursor-pointer transition-colors`}
        >
          {label} {count}
        </button>
        
        {/* Dropdown for multiple stages */}
        {selectedStage === `${stageType}_${status}` && stages.length > 1 && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
            <div className="p-2">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Select room to view:
              </p>
              {stages.map((stage, index) => (
                <Link
                  key={stage.id}
                  href={`/stages/${stage.id}`}
                  target="_blank"
                  className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setSelectedStage(null)}
                >
                  {stage.roomName}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Workflow Progress</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Design Stage */}
          <div className="text-center">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Palette className="w-8 h-8 text-pink-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Design</h4>
            <div className="space-y-1">
              <StageStatusItem
                label="✓"
                count={stageStats.design.complete}
                color="text-green-600"
                stageType="DESIGN"
                status="COMPLETED"
              />
              <StageStatusItem
                label="🔄"
                count={stageStats.design.inProgress}
                color="text-blue-600"
                stageType="DESIGN"
                status="IN_PROGRESS"
              />
              <StageStatusItem
                label="⏳"
                count={stageStats.design.notStarted}
                color="text-gray-600"
                stageType="DESIGN"
                status="NOT_STARTED"
              />
            </div>
          </div>

          {/* 3D Rendering Stage */}
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Box className="w-8 h-8 text-indigo-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">3D Rendering</h4>
            <div className="space-y-1">
              <StageStatusItem
                label="✓"
                count={stageStats.threeD.complete}
                color="text-green-600"
                stageType="THREE_D"
                status="COMPLETED"
              />
              <StageStatusItem
                label="🔄"
                count={stageStats.threeD.inProgress}
                color="text-blue-600"
                stageType="THREE_D"
                status="IN_PROGRESS"
              />
              <StageStatusItem
                label="⏳"
                count={stageStats.threeD.notStarted}
                color="text-gray-600"
                stageType="THREE_D"
                status="NOT_STARTED"
              />
            </div>
          </div>

          {/* Client Approval Stage */}
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-yellow-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Client Approval</h4>
            <div className="space-y-1">
              <StageStatusItem
                label="✓"
                count={stageStats.clientApproval.complete}
                color="text-green-600"
                stageType="CLIENT_APPROVAL"
                status="COMPLETED"
              />
              <StageStatusItem
                label="🔄"
                count={stageStats.clientApproval.inProgress}
                color="text-blue-600"
                stageType="CLIENT_APPROVAL"
                status="IN_PROGRESS"
              />
              <StageStatusItem
                label="⏳"
                count={stageStats.clientApproval.notStarted}
                color="text-gray-600"
                stageType="CLIENT_APPROVAL"
                status="NOT_STARTED"
              />
            </div>
          </div>

          {/* Technical Drawings Stage */}
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Technical Drawings</h4>
            <div className="space-y-1">
              <StageStatusItem
                label="✓"
                count={stageStats.drawings.complete}
                color="text-green-600"
                stageType="DRAWINGS"
                status="COMPLETED"
              />
              <StageStatusItem
                label="🔄"
                count={stageStats.drawings.inProgress}
                color="text-blue-600"
                stageType="DRAWINGS"
                status="IN_PROGRESS"
              />
              <StageStatusItem
                label="⏳"
                count={stageStats.drawings.notStarted}
                color="text-gray-600"
                stageType="DRAWINGS"
                status="NOT_STARTED"
              />
            </div>
          </div>

          {/* FFE Stage */}
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">FFE</h4>
            <div className="space-y-1">
              <StageStatusItem
                label="✓"
                count={stageStats.ffe.complete}
                color="text-green-600"
                stageType="FFE"
                status="COMPLETED"
              />
              <StageStatusItem
                label="🔄"
                count={stageStats.ffe.inProgress}
                color="text-blue-600"
                stageType="FFE"
                status="IN_PROGRESS"
              />
              <StageStatusItem
                label="⏳"
                count={stageStats.ffe.notStarted}
                color="text-gray-600"
                stageType="FFE"
                status="NOT_STARTED"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {selectedStage && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setSelectedStage(null)}
        />
      )}
    </>
  )
}
