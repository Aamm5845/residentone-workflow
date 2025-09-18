'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface WorkflowProgressProps {
  room: any
}

export default function WorkflowProgress({ room }: WorkflowProgressProps) {
  const router = useRouter()

  const getPhaseIcon = (phaseType: string) => {
    switch (phaseType) {
      case 'DESIGN': return '🎨'
      case 'THREE_D': return '🎥'
      case 'DRAWINGS': return '📐'
      case 'FFE': return '🛋️'
      default: return '⏳'
    }
  }

  const handleStartDesign = () => {
    const designStage = room.stages.find((s: any) => s.type === 'DESIGN')
    if (designStage) {
      router.push(`/stages/${designStage.id}`)
    }
  }

  return (
    <div className="flex space-x-4 overflow-x-auto pb-4">
      {['DESIGN', 'THREE_D', 'DRAWINGS', 'FFE'].map((phase, index) => {
        const phaseStage = room.stages.find((s: any) => s.type === phase)
        const isActive = phaseStage?.status === 'IN_PROGRESS'
        const isCompleted = phaseStage?.status === 'COMPLETED'
        const isNext = !isCompleted && !isActive && room.stages.findIndex((s: any) => s.status === 'IN_PROGRESS') < 0 && index === 0
        
        return (
          <div key={phase} className="flex-shrink-0 w-64">
            <div className={`rounded-lg border-2 transition-all duration-200 ${
              isActive ? 'border-blue-400 bg-blue-50' :
              isCompleted ? 'border-green-400 bg-green-50' :
              isNext ? 'border-purple-400 bg-purple-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <div className="px-4 py-3 border-b border-current/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPhaseIcon(phase)}</span>
                    <h4 className="font-medium text-gray-900">
                      {phase === 'THREE_D' ? '3D' : phase.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    isCompleted ? 'bg-green-500' :
                    isActive ? 'bg-blue-500' :
                    isNext ? 'bg-purple-500' :
                    'bg-gray-300'
                  }`} />
                </div>
              </div>
              <div className="p-4 min-h-[120px]">
                {isCompleted && (
                  <div className="flex items-center space-x-2 text-green-600 text-sm">
                    <span>✅</span>
                    <span>Phase Complete</span>
                  </div>
                )}
                {isActive && (
                  <div className="flex items-center space-x-2 text-blue-600 text-sm">
                    <span>🔄</span>
                    <span>In Progress</span>
                  </div>
                )}
                {isNext && phase === 'DESIGN' && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-purple-600 text-sm">
                      <span>⏳</span>
                      <span>Ready to Start</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={handleStartDesign}
                    >
                      Start Design
                    </Button>
                  </div>
                )}
                {isNext && phase !== 'DESIGN' && (
                  <div className="flex items-center space-x-2 text-purple-600 text-sm">
                    <span>⏳</span>
                    <span>Ready to Start</span>
                  </div>
                )}
                {!isCompleted && !isActive && !isNext && (
                  <div className="text-gray-500 text-sm">
                    <span>Pending</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}