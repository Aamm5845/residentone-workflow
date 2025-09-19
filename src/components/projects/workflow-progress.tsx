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
  Users,
  Play
} from 'lucide-react'
import { WORKFLOW_STAGES, STAGE_CONFIG, getStageConfig, type StageStatus } from '@/constants/workflow'

interface WorkflowProgressProps {
  projectId: string
  stageStats: {
    designConcept: { complete: number, inProgress: number, notStarted: number }
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

  // Helper to get stats key for each stage type
  const getStatsKey = (stageType: string) => {
    switch (stageType) {
      case 'DESIGN_CONCEPT': return 'designConcept'
      case 'THREE_D': return 'threeD'
      case 'CLIENT_APPROVAL': return 'clientApproval'
      case 'DRAWINGS': return 'drawings'
      case 'FFE': return 'ffe'
      default: return 'designConcept'
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Workflow Progress</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 xl:gap-6">
          {WORKFLOW_STAGES.map((stageType) => {
            const config = getStageConfig(stageType)
            const statsKey = getStatsKey(stageType)
            const stats = stageStats[statsKey as keyof typeof stageStats]
            
            return (
              <div key={stageType} className="text-center group">
                <div className="relative">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:scale-110 ${
                    config.baseColor
                  } shadow-lg`}>
                    <span className="text-2xl">{config.icon}</span>
                  </div>
                  {/* Subtle glow effect */}
                  <div className={`absolute inset-0 w-16 h-16 mx-auto rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${
                    config.baseColor
                  } blur-lg`}></div>
                </div>
                <h4 className="font-semibold text-gray-900 mb-3 text-sm xl:text-base">{config.name}</h4>
                <div className="space-y-1">
                  <StageStatusItem
                    label="✓"
                    count={stats.complete}
                    color="text-green-600"
                    stageType={stageType}
                    status="COMPLETED"
                  />
                  <StageStatusItem
                    label="🔄"
                    count={stats.inProgress}
                    color="text-blue-600"
                    stageType={stageType}
                    status="IN_PROGRESS"
                  />
                  <StageStatusItem
                    label="⏳"
                    count={stats.notStarted}
                    color="text-gray-600"
                    stageType={stageType}
                    status="NOT_STARTED"
                  />
                </div>
              </div>
            )
          })}
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
