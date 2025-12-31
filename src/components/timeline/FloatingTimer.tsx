'use client'

import { useState } from 'react'
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import {
  Play,
  Pause,
  Square,
  Timer,
  FolderOpen,
  Home,
  Layers,
  ChevronUp,
  ChevronDown,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

export function FloatingTimer() {
  const {
    activeEntry,
    elapsedSeconds,
    isRunning,
    isPaused,
    pauseTimer,
    resumeTimer,
    stopTimer
  } = useTimer()

  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true) // Start minimized/collapsed by default
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [customEndDate, setCustomEndDate] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [isStopping, setIsStopping] = useState(false)

  // Don't show if no active timer
  if (!activeEntry) return null

  // Check if timer has been running overnight (more than 12 hours)
  const hoursRunning = elapsedSeconds / 3600
  const isOvernightTimer = hoursRunning > 12

  const formatStageType = (type: string) => {
    return getStageName(type)
  }

  const handlePauseResume = async () => {
    if (isRunning) {
      await pauseTimer()
    } else if (isPaused) {
      await resumeTimer()
    }
  }

  const handleStopClick = () => {
    if (isOvernightTimer) {
      // Pre-fill with start date and a reasonable end time (6 PM on start day)
      const startDate = new Date(activeEntry.startTime)
      setCustomEndDate(startDate.toISOString().split('T')[0])
      setCustomEndTime('18:00')
      setShowStopDialog(true)
    } else {
      // Normal stop
      handleStopNow()
    }
  }

  const handleStopNow = async () => {
    setIsStopping(true)
    try {
      await stopTimer()
    } finally {
      setIsStopping(false)
      setShowStopDialog(false)
    }
  }

  const handleStopWithCustomTime = async () => {
    if (!customEndDate || !customEndTime) return

    setIsStopping(true)
    try {
      const endDateTime = new Date(`${customEndDate}T${customEndTime}`)
      await stopTimer({ endTime: endDateTime.toISOString() })
    } finally {
      setIsStopping(false)
      setShowStopDialog(false)
    }
  }

  // Minimized pill view
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105",
            isRunning 
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" 
              : "bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
          )}
        >
          {isRunning ? (
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
          <span className="font-mono font-bold text-sm">{formatElapsedTime(elapsedSeconds)}</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div 
        className={cn(
          "rounded-2xl shadow-2xl overflow-hidden transition-all duration-300",
          isRunning 
            ? "ring-2 ring-green-400/50" 
            : "ring-2 ring-yellow-400/50"
        )}
        style={{
          width: isExpanded ? '320px' : '280px',
        }}
      >
        {/* Header with gradient */}
        <div 
          className={cn(
            "px-4 py-3 flex items-center justify-between cursor-pointer select-none",
            isRunning 
              ? "bg-gradient-to-r from-green-500 to-emerald-500" 
              : "bg-gradient-to-r from-yellow-500 to-amber-500"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 text-white">
            <div className="relative">
              <Timer className="w-5 h-5" />
              {isRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <div className="font-mono font-bold text-lg tracking-wide">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              <div className="text-white/80 text-xs">
                {isRunning ? 'Recording...' : 'Paused'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(true) }}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              title="Minimize"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white p-4 space-y-3">
          {/* Project info */}
          {(activeEntry.project || activeEntry.room || activeEntry.stage) && (
            <div className={cn(
              "space-y-1.5 text-sm transition-all",
              isExpanded ? "block" : "hidden"
            )}>
              {activeEntry.project && (
                <div className="flex items-center text-gray-700">
                  <FolderOpen className="w-4 h-4 text-[#a657f0] mr-2 flex-shrink-0" />
                  <span className="truncate">{activeEntry.project.name}</span>
                </div>
              )}
              {activeEntry.room && (
                <div className="flex items-center text-gray-600">
                  <Home className="w-4 h-4 text-[#f6762e] mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {activeEntry.room.name || activeEntry.room.type.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {activeEntry.stage && (
                <div className="flex items-center text-gray-600">
                  <Layers className="w-4 h-4 text-[#14b8a6] mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {formatStageType(activeEntry.stage.type)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Compact project info when collapsed */}
          {!isExpanded && activeEntry.project && (
            <div className="text-sm text-gray-600 truncate">
              {activeEntry.project.name}
              {activeEntry.stage && ` • ${formatStageType(activeEntry.stage.type)}`}
            </div>
          )}

          {/* Overnight warning */}
          {isOvernightTimer && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Timer running {Math.floor(hoursRunning)}+ hours</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "flex-1 h-9",
                isRunning
                  ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              )}
              onClick={handlePauseResume}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-1.5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1.5" />
                  Resume
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleStopClick}
            >
              <Square className="w-4 h-4 mr-1.5" />
              Stop
            </Button>
          </div>
        </div>
      </div>

      {/* Stop Timer Dialog for Overnight Timers */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Stop Timer
            </DialogTitle>
            <DialogDescription>
              This timer has been running for over {Math.floor(hoursRunning)} hours.
              When did you actually stop working?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="text-gray-600">
                Started: {new Date(activeEntry.startTime).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={activeEntry.startTime.split('T')[0]}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleStopNow}
              disabled={isStopping}
            >
              Stop Now
            </Button>
            <Button
              onClick={handleStopWithCustomTime}
              disabled={isStopping || !customEndDate || !customEndTime}
              className="bg-red-600 hover:bg-red-700"
            >
              {isStopping ? 'Stopping...' : 'Stop at Selected Time'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

