'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext'
import { Timer, Play, Pause, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

interface WorkspaceTimerButtonProps {
  projectId: string
  roomId: string
  stageId: string
  stageType: string
  className?: string
}

/**
 * A timer button for stage/phase workspaces.
 * Shows different states based on whether a timer is running for this stage,
 * another stage, or not running at all.
 */
export function WorkspaceTimerButton({
  projectId,
  roomId,
  stageId,
  stageType,
  className
}: WorkspaceTimerButtonProps) {
  const { 
    activeEntry, 
    elapsedSeconds,
    isRunning, 
    isPaused, 
    startTimer, 
    pauseTimer,
    resumeTimer,
    stopTimer,
    isLoading 
  } = useTimer()
  
  const [isStarting, setIsStarting] = useState(false)
  
  // Check timer status relative to this stage
  const isTimerForThisStage = activeEntry?.stageId === stageId
  const hasActiveTimerElsewhere = !!activeEntry && !isTimerForThisStage
  
  const handleStart = async () => {
    if (activeEntry) return // Already have a timer running
    
    setIsStarting(true)
    try {
      await startTimer({
        projectId,
        roomId,
        stageId,
        description: `Working on ${getStageName(stageType)}`
      })
    } finally {
      setIsStarting(false)
    }
  }
  
  const handlePauseResume = async () => {
    if (isRunning) {
      await pauseTimer()
    } else if (isPaused) {
      await resumeTimer()
    }
  }
  
  const handleStop = async () => {
    await stopTimer()
  }
  
  // Timer is running for THIS stage - show full controls
  if (isTimerForThisStage) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Timer Display */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-medium",
          isRunning 
            ? "bg-green-100 text-green-700 border border-green-200"
            : "bg-yellow-100 text-yellow-700 border border-yellow-200"
        )}>
          {isRunning ? (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          ) : (
            <Pause className="w-3 h-3" />
          )}
          <span>{formatElapsedTime(elapsedSeconds)}</span>
        </div>
        
        {/* Pause/Resume Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePauseResume}
          className={cn(
            isRunning 
              ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              : "border-green-300 text-green-700 hover:bg-green-50"
          )}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              Resume
            </>
          )}
        </Button>
        
        {/* Stop Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <Square className="w-4 h-4 mr-1" />
          Stop
        </Button>
      </div>
    )
  }
  
  // Timer is running for ANOTHER stage
  if (hasActiveTimerElsewhere) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn("text-gray-500", className)}
      >
        <Timer className="w-4 h-4 mr-2" />
        Timer Active Elsewhere
      </Button>
    )
  }
  
  // No timer running - show start button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleStart}
      disabled={isStarting || isLoading}
      className={cn(
        "border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-400",
        className
      )}
    >
      <Timer className="w-4 h-4 mr-2" />
      {isStarting ? 'Starting...' : 'Track Time'}
    </Button>
  )
}
