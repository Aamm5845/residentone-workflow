'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle, Minus } from 'lucide-react'
import { WORKFLOW_STAGES, getStageConfig, getStageStatusColor, getStageStatusTextColor, type StageStatus } from '@/constants/workflow'
import { useStageActions } from '@/hooks/useWorkflow'

interface WorkflowProgressProps {
  room: any
}

export default function WorkflowProgress({ room }: WorkflowProgressProps) {
  const router = useRouter()
  const { startStage, closeStage, isLoading } = useStageActions()
  const [error, setError] = useState<string | null>(null)

  const handleStartPhase = async (stageId: string, stageType: string) => {
    
    setError(null)
    try {
      
      await startStage(stageId)
      
      // SWR will automatically update the UI without page reload
    } catch (error) {
      console.error('❌ handleStartPhase error:', error)
      setError(`Failed to start ${stageType} phase. Please try again.`)
    }
  }

  const handleMarkNotApplicable = async (stageId: string, stageType: string) => {
    
    setError(null)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_not_applicable'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark as not applicable')
      }

      // SWR will automatically update the UI
      window.location.reload() // Force reload to see changes immediately
    } catch (error) {
      console.error('❌ handleMarkNotApplicable error:', error)
      setError(`Failed to mark ${stageType} as not applicable. Please try again.`)
    }
  }

  const handleMarkApplicable = async (stageId: string, stageType: string) => {
    
    setError(null)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_applicable'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark as applicable')
      }

      // SWR will automatically update the UI
      window.location.reload() // Force reload to see changes immediately
    } catch (error) {
      console.error('❌ handleMarkApplicable error:', error)
      setError(`Failed to mark ${stageType} as applicable. Please try again.`)
    }
  }

  const handleClosePhase = async (stageId: string, stageType: string) => {
    
    setError(null)
    try {
      
      await closeStage(stageId)
      
      // SWR will automatically update the UI without page reload
    } catch (error) {
      console.error('❌ handleClosePhase error:', error)
      setError(`Failed to close ${stageType} phase. Please try again.`)
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
        const isNotApplicable = status === 'NOT_APPLICABLE'
        const isStarting = isLoading === phaseStage?.id
        
        return (
          <div key={stageType} className={`flex-shrink-0 w-72 group ${
            isNotApplicable ? 'opacity-60' : ''
          }`}>
            <div className={`rounded-xl border-2 transition-all duration-300 transform group-hover:scale-105 ${
              isNotApplicable 
                ? 'border-gray-300 bg-gray-50' 
                : getStageStatusColor(stageType, status)
            }`}>
              <div className="px-5 py-4 border-b border-current/10 bg-gradient-to-r from-transparent to-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${
                      isNotApplicable 
                        ? 'bg-gray-400' 
                        : stageConfig.baseColor
                    }`}>
                      <span className="text-lg text-white">
                        {isNotApplicable ? '➖' : stageConfig.icon}
                      </span>
                    </div>
                    <div>
                      <h4 className={`font-semibold text-base ${
                        isNotApplicable 
                          ? 'text-gray-500' 
                          : getStageStatusTextColor(stageType, status)
                      }`}>
                        {stageConfig.name}
                      </h4>
                      <p className={`text-xs mt-0.5 ${
                        isNotApplicable ? 'text-gray-400' : 'text-gray-500'
                      }`}>{stageConfig.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <div className={`w-4 h-4 rounded-full ${
                      isCompleted ? 'bg-green-500 ring-2 ring-green-200' :
                      isActive ? 'bg-blue-500 animate-pulse ring-2 ring-blue-200' :
                      isNotApplicable ? 'bg-gray-400 ring-2 ring-gray-200' :
                      'bg-gray-300'
                    }`} />
                    <span className="text-xs font-medium ${
                      isCompleted ? 'text-green-600' :
                      isActive ? 'text-blue-600' :
                      isNotApplicable ? 'text-gray-500' :
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
                  {isNotApplicable && (
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Minus className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600 text-sm">Not Applicable</span>
                        <p className="text-xs text-gray-500">This phase is not needed for this room</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto pt-2">
                  {canStart && phaseStage && (
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        className={`w-full text-white font-semibold ${
                          stageConfig.baseColor
                        } hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200 shadow-md`}
                        onClick={() => {
                          
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-slate-600 border-slate-300 hover:bg-slate-50 text-xs"
                        onClick={() => handleMarkNotApplicable(phaseStage.id, stageType)}
                      >
                        <Minus className="w-3 h-3 mr-2" />
                        Not Applicable
                      </Button>
                    </div>
                  )}
                  {isActive && phaseStage && (
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full border-2 hover:bg-gray-50 hover:scale-105 transition-all duration-200 font-semibold"
                        onClick={() => router.push(`/stages/${phaseStage.id}`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Open Workspace
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-xs"
                        onClick={() => handleClosePhase(phaseStage.id, stageType)}
                      >
                        Close Phase
                      </Button>
                    </div>
                  )}
                  {isNotApplicable && phaseStage && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full text-slate-600 border-slate-300 hover:bg-slate-50"
                      onClick={() => handleMarkApplicable(phaseStage.id, stageType)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Mark Applicable
                    </Button>
                  )}
                  {isCompleted && phaseStage && (
                    <div className="text-center py-2 space-y-2">
                      <div className="mb-2">
                        <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
                        <span className="text-xs text-green-600 font-medium">Phase Complete</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full border-green-300 text-green-700 hover:bg-green-50 transition-all duration-200"
                        onClick={() => router.push(`/stages/${phaseStage.id}`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Open Workspace
                      </Button>
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
