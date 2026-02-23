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
        <button
          className="flex items-center h-9 px-2.5 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          onClick={() => setShowModal(true)}
          title="Track Time"
        >
          <Play className="w-[18px] h-[18px] md:mr-1.5" />
          <span className="hidden md:inline text-sm font-medium">Track Time</span>
        </button>
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
          <button
            className={cn(
              "flex items-center h-9 px-3 rounded-lg text-sm font-mono transition-colors",
              isRunning && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              isPaused && "bg-amber-50 text-amber-700 hover:bg-amber-100"
            )}
          >
            {isRunning ? (
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
            ) : isPaused ? (
              <Pause className="w-3.5 h-3.5 mr-2 text-amber-500" />
            ) : null}
            <span className="font-medium text-[13px]">{formatElapsedTime(elapsedSeconds)}</span>
            <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-40" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4 rounded-xl" align="end">
          <div className="space-y-3">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-stone-900">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                {isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
              </div>
            </div>

            {/* Entry Details */}
            <div className="bg-stone-50 rounded-lg p-2.5 space-y-1.5">
              {activeEntry.project && (
                <div className="flex items-center text-sm">
                  <FolderOpen className="w-3.5 h-3.5 text-stone-400 mr-2" />
                  <span className="text-stone-600">{activeEntry.project.name}</span>
                </div>
              )}
              {activeEntry.room && (
                <div className="flex items-center text-sm">
                  <Home className="w-3.5 h-3.5 text-stone-400 mr-2" />
                  <span className="text-stone-600">
                    {activeEntry.room.name || activeEntry.room.type.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {activeEntry.stage && (
                <div className="flex items-center text-sm">
                  <Layers className="w-3.5 h-3.5 text-stone-400 mr-2" />
                  <span className="text-stone-600">
                    {formatStageType(activeEntry.stage.type)}
                  </span>
                </div>
              )}
              {activeEntry.description && (
                <div className="text-sm text-stone-500 mt-1.5 pt-1.5 border-t border-stone-200">
                  {activeEntry.description}
                </div>
              )}
              {!activeEntry.project && !activeEntry.room && !activeEntry.description && (
                <div className="text-sm text-stone-400 italic">
                  No project or description
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <button
                className={cn(
                  "flex-1 flex items-center justify-center h-9 rounded-lg text-sm font-medium transition-colors",
                  isRunning
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
              </button>
              <button
                className="flex-1 flex items-center justify-center h-9 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                onClick={handleStopClick}
              >
                <Square className="w-4 h-4 mr-1.5" />
                Stop
              </button>
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
