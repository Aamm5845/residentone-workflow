'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle } from 'lucide-react'
import { WORKFLOW_STAGES, getStageConfig, getStageStatusColor, getStageStatusTextColor, type StageStatus } from '@/constants/workflow'
import { useStageActions } from '@/hooks/useWorkflow'

interface WorkflowProgressProps {
  room: any
}

export default function WorkflowProgress({ room }: WorkflowProgressProps) {
  const router = useRouter()
  const { startStage, isLoading } = useStageActions()
  const [error, setError] = useState<string | null>(null)

  const handleStartPhase = async (stageId: string, stageType: string) => {
    console.log('🔄 handleStartPhase called:', { stageId, stageType })
    setError(null)
    try {
      console.log('🏁 About to call startStage...')
      await startStage(stageId)
      console.log('✅ startStage completed successfully')
      // SWR will automatically update the UI without page reload
    } catch (error) {
      console.error('❌ handleStartPhase error:', error)
      setError(`Failed to start ${stageType} phase. Please try again.`)
    }
  }


  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex space-x-4 overflow-x-auto pb-4">
      {WORKFLOW_STAGES.map((stageType) => {
        const stageConfig = getStageConfig(stageType)
        
        // Find stage with fallback for legacy stage types
        let phaseStage = room.stages.find((s: any) => s.type === stageType)
        if (!phaseStage && stageType === 'DESIGN_CONCEPT') {
          // Fallback: also look for old 'DESIGN' type
          phaseStage = room.stages.find((s: any) => s.type === 'DESIGN')
        }
        if (!phaseStage && stageType === 'THREE_D') {
          // Fallback: also look for old 'RENDERING' type
          phaseStage = room.stages.find((s: any) => s.type === 'RENDERING')
        }
        
        const status = phaseStage?.status as StageStatus || 'NOT_STARTED'
        const isCompleted = status === 'COMPLETED'
        const isActive = status === 'IN_PROGRESS'
        const canStart = status === 'NOT_STARTED'
        const isStarting = isLoading === phaseStage?.id
        
        // Debug logging
        if (stageType === 'DESIGN_CONCEPT') {
          console.log('🔍 DESIGN_CONCEPT stage debug:', { 
            stageType, 
            phaseStage, 
            allStages: room.stages.map((s: any) => ({ id: s.id, type: s.type, status: s.status })), 
            status, 
            canStart, 
            isStarting 
          })
        }
        
        return (
          <div key={stageType} className="flex-shrink-0 w-72 group">
            <div className={`rounded-xl border-2 transition-all duration-300 transform group-hover:scale-105 ${
              getStageStatusColor(stageType, status)
            }`}>
              <div className="px-5 py-4 border-b border-current/10 bg-gradient-to-r from-transparent to-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      stageConfig.baseColor
                    } shadow-md`}>
                      <span className="text-lg text-white">{stageConfig.icon}</span>
                    </div>
                    <div>
                      <h4 className={`font-semibold text-base ${
                        getStageStatusTextColor(stageType, status)
                      }`}>
                        {stageConfig.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">{stageConfig.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <div className={`w-4 h-4 rounded-full ${
                      isCompleted ? 'bg-green-500 ring-2 ring-green-200' :
                      isActive ? 'bg-blue-500 animate-pulse ring-2 ring-blue-200' :
                      'bg-gray-300'
                    }`} />
                    <span className="text-xs font-medium ${
                      isCompleted ? 'text-green-600' :
                      isActive ? 'text-blue-600' :
                      'text-gray-400'
                    }">
                      {isCompleted ? 'Done' : isActive ? 'Active' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-5 min-h-[140px] flex flex-col justify-between">
                <div className="space-y-3">
                  {isCompleted && (
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <span className="font-semibold text-green-800 text-sm">Completed</span>
                        <p className="text-xs text-green-600">Phase finished successfully</p>
                      </div>
                    </div>
                  )}
                  {isActive && (
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-blue-600 animate-pulse" />
                      </div>
                      <div>
                        <span className="font-semibold text-blue-800 text-sm">In Progress</span>
                        <p className="text-xs text-blue-600">Currently working on this phase</p>
                      </div>
                    </div>
                  )}
                  {canStart && (
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-500">⏳</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 text-sm">Ready to Start</span>
                        <p className="text-xs text-gray-500">Click below to begin this phase</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto pt-2">
                  {canStart && phaseStage && (
                    <Button 
                      size="sm" 
                      className={`w-full text-white font-semibold ${
                        stageConfig.baseColor
                      } hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200 shadow-md`}
                      onClick={() => {
                        console.log('💆 Button clicked!', { phaseStageId: phaseStage.id, stageType, canStart, isStarting })
                        handleStartPhase(phaseStage.id, stageType)
                      }}
                      disabled={isStarting}
                    >
                      {isStarting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start {stageConfig.name}
                        </>
                      )}
                    </Button>
                  )}
                  {isActive && phaseStage && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full border-2 hover:bg-gray-50 hover:scale-105 transition-all duration-200 font-semibold"
                      onClick={() => router.push(`/stages/${phaseStage.id}`)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Open Workspace
                    </Button>
                  )}
                  {isCompleted && (
                    <div className="text-center py-2">
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
                      <span className="text-xs text-green-600 font-medium">Phase Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
