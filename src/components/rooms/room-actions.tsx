'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Settings, CheckCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RoomActionsProps {
  room: any
  project: any
  onStartDesign?: () => void
}

export default function RoomActions({ room, project, onStartDesign }: RoomActionsProps) {
  const [isStarting, setIsStarting] = useState(false)
  const router = useRouter()

  const handleStartDesign = async () => {
    setIsStarting(true)
    
    try {
      // Find the design stage
      const designStage = room.stages.find((s: any) => s.type === 'DESIGN')
      
      if (designStage) {
        // Call the API to start the design stage
        const response = await fetch(`/api/stages/${designStage.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'start',
            assignedTo: null // Auto-assign
          })
        })

        if (response.ok) {
          // Navigate to the design stage
          router.push(`/stages/${designStage.id}`)
          
          // Call callback if provided
          onStartDesign?.()
        } else {
          console.error('Failed to start design stage')
        }
      } else {
        console.error('No design stage found')
      }
    } catch (error) {
      console.error('Error starting design stage:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const getDesignStageStatus = () => {
    const designStage = room.stages.find((s: any) => s.type === 'DESIGN')
    if (!designStage) return 'not_started'
    return designStage.status?.toLowerCase() || 'not_started'
  }

  const designStageStatus = getDesignStageStatus()

  return (
    <div className="flex items-center space-x-3">
      {/* Start Design Button */}
      {designStageStatus === 'not_started' && (
        <Button 
          onClick={handleStartDesign}
          disabled={isStarting}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isStarting ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Design
            </>
          )}
        </Button>
      )}

      {/* Continue Design Button */}
      {designStageStatus === 'in_progress' && (
        <Button 
          onClick={() => {
            const designStage = room.stages.find((s: any) => s.type === 'DESIGN')
            if (designStage) {
              router.push(`/stages/${designStage.id}`)
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Play className="w-4 h-4 mr-2" />
          Continue Design
        </Button>
      )}

      {/* Design Complete */}
      {designStageStatus === 'completed' && (
        <Button 
          onClick={() => {
            const designStage = room.stages.find((s: any) => s.type === 'DESIGN')
            if (designStage) {
              router.push(`/stages/${designStage.id}`)
            }
          }}
          variant="outline"
          className="border-green-500 text-green-600 hover:bg-green-50"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          View Design
        </Button>
      )}

      {/* Room Settings */}
      <Button variant="outline">
        <Settings className="w-4 h-4 mr-2" />
        Room Settings
      </Button>
    </div>
  )
}