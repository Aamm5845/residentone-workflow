'use client'

import { useState } from 'react'
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TimeEntryModal } from './TimeEntryModal'
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  ChevronDown,
  FolderOpen,
  Home,
  Layers,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

export function TimerButton() {
  const { 
    activeEntry, 
    elapsedSeconds, 
    isRunning, 
    isPaused, 
    isLoading,
    pauseTimer,
    resumeTimer,
    stopTimer 
  } = useTimer()

  const [showModal, setShowModal] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [customEndTime, setCustomEndTime] = useState('')
  const [useCustomEndTime, setUseCustomEndTime] = useState(false)

  const handleMainClick = () => {
    if (!activeEntry) {
      setShowModal(true)
    } else {
      setShowPopover(!showPopover)
    }
  }

  const handlePauseResume = async () => {
    if (isRunning) {
      await pauseTimer()
    } else if (isPaused) {
      await resumeTimer()
    }
  }

  const handleStopClick = () => {
    // Show the stop dialog to allow custom end time
    setShowStopDialog(true)
    setShowPopover(false)
    
    // Pre-fill with current time
    const now = new Date()
    const timeStr = now.toTimeString().slice(0, 5) // HH:MM format
    setCustomEndTime(timeStr)
    setUseCustomEndTime(false)
  }

  const handleConfirmStop = async () => {
    if (useCustomEndTime && customEndTime) {
      // Build full datetime from today + custom time
      const today = new Date()
      const [hours, minutes] = customEndTime.split(':').map(Number)
      today.setHours(hours, minutes, 0, 0)
      
      // If the custom time is in the future, use current time instead
      const now = new Date()
      if (today > now) {
        await stopTimer()
      } else {
        await stopTimer({ endTime: today.toISOString() })
      }
    } else {
      await stopTimer()
    }
    setShowStopDialog(false)
    setUseCustomEndTime(false)
    setCustomEndTime('')
  }

  const formatStageType = (type: string) => {
    return getStageName(type)
  }

  // Don't show loading state - just show the start button while loading
  // This prevents the brief "Loading..." flash on page refresh

  // No active timer - show start button
  if (!activeEntry) {
    return (
      <>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-3 border-[#14b8a6]/30 text-[#14b8a6] hover:bg-[#14b8a6]/10 hover:border-[#14b8a6]/50"
          onClick={() => setShowModal(true)}
        >
          <Play className="w-4 h-4 md:mr-1.5" />
          <span className="hidden md:inline text-sm">Track Time</span>
        </Button>
        <TimeEntryModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
        />
      </>
    )
  }

  // Active timer - show timer display with controls
  return (
    <>
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "min-w-[120px] justify-start font-mono",
              isRunning && "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
              isPaused && "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            )}
          >
            {isRunning ? (
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            ) : isPaused ? (
              <Pause className="w-4 h-4 mr-2 text-yellow-600" />
            ) : null}
            <span className="font-medium">{formatElapsedTime(elapsedSeconds)}</span>
            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-gray-900">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
              </div>
            </div>

            {/* Entry Details */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {activeEntry.project && (
                <div className="flex items-center text-sm">
                  <FolderOpen className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-700">{activeEntry.project.name}</span>
                </div>
              )}
              {activeEntry.room && (
                <div className="flex items-center text-sm">
                  <Home className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-700">
                    {activeEntry.room.name || activeEntry.room.type.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {activeEntry.stage && (
                <div className="flex items-center text-sm">
                  <Layers className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-700">
                    {formatStageType(activeEntry.stage.type)}
                  </span>
                </div>
              )}
              {activeEntry.description && (
                <div className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
                  {activeEntry.description}
                </div>
              )}
              {!activeEntry.project && !activeEntry.room && !activeEntry.description && (
                <div className="text-sm text-gray-400 italic">
                  No project or description
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn(
                  "flex-1",
                  isRunning 
                    ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" 
                    : "border-green-300 text-green-700 hover:bg-green-50"
                )}
                onClick={handlePauseResume}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleStopClick}
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <TimeEntryModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />

      {/* Stop Timer Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Stop Timer</DialogTitle>
            <DialogDescription>
              Stop the current timer. You can adjust the end time if needed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current timer info */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-mono font-bold text-center text-gray-900">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              {activeEntry?.project && (
                <div className="text-sm text-center text-gray-600 mt-1">
                  {activeEntry.project.name}
                </div>
              )}
            </div>
            
            {/* Custom end time option */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useCustomEndTime"
                  checked={useCustomEndTime}
                  onChange={(e) => setUseCustomEndTime(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <Label htmlFor="useCustomEndTime" className="text-sm font-medium text-gray-700">
                  Set custom end time (forgot to stop?)
                </Label>
              </div>
              
              {useCustomEndTime && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <Input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-gray-500">today</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Use this if you forgot to stop the timer earlier. 
                      The end time cannot be in the future.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStopDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStop}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
