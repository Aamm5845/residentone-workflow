'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTimer } from '@/contexts/TimerContext'
import { Play, Clock, Calendar, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import { getStageName } from '@/constants/workflow'

interface TimeEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Projects API returns array directly, not { projects: [...] }
const projectsFetcher = (url: string) => fetch(url).then(res => res.json()).then(data => Array.isArray(data) ? data : [])

export function TimeEntryModal({ isOpen, onClose, onSuccess }: TimeEntryModalProps) {
  const { startTimer, activeEntry } = useTimer()
  const [mode, setMode] = useState<'timer' | 'manual'>('timer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [projectId, setProjectId] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')
  const [description, setDescription] = useState('')
  
  // Timer mode - custom start time
  const [useCustomStartTime, setUseCustomStartTime] = useState(false)
  const [customStartTime, setCustomStartTime] = useState('')
  
  // Manual mode - date and times
  const [manualDate, setManualDate] = useState('')
  const [manualStartTime, setManualStartTime] = useState('')
  const [manualEndTime, setManualEndTime] = useState('')

  // Fetch projects - API returns array directly
  const { data: projectsData } = useSWR(isOpen ? '/api/projects' : null, projectsFetcher)
  const projects = projectsData || []

// Fetch project details including rooms (with stages already included)
  const { data: projectData } = useSWR(
    isOpen && projectId ? `/api/projects/${projectId}` : null, 
    fetcher
  )
  const rooms = projectData?.rooms || []

  // Get stages from selected room (already included in project data)
  const selectedRoom = rooms.find((r: any) => r.id === roomId)
  const stages = selectedRoom?.stages || []

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectId('')
      setRoomId('')
      setStageId('')
      setDescription('')
      setUseCustomStartTime(false)
      setCustomStartTime('')
      setManualDate(new Date().toISOString().split('T')[0])
      setManualStartTime('')
      setManualEndTime('')
    }
  }, [isOpen])

  // Reset room and stage when project changes
  useEffect(() => {
    setRoomId('')
    setStageId('')
  }, [projectId])

  // Reset stage when room changes
  useEffect(() => {
    setStageId('')
  }, [roomId])

  const handleStartTimer = async () => {
    if (activeEntry) {
      return // Already have an active timer
    }

    setIsSubmitting(true)
    try {
      let startTime: string | undefined
      if (useCustomStartTime && customStartTime) {
        startTime = new Date(customStartTime).toISOString()
      }

      const entry = await startTimer({
        projectId: projectId || undefined,
        roomId: roomId || undefined,
        stageId: stageId || undefined,
        description: description || undefined,
        startTime
      })

      if (entry) {
        onClose()
        onSuccess?.()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddManualEntry = async () => {
    if (!manualDate || !manualStartTime || !manualEndTime) {
      return
    }

    setIsSubmitting(true)
    try {
      const startDateTime = new Date(`${manualDate}T${manualStartTime}`)
      const endDateTime = new Date(`${manualDate}T${manualEndTime}`)

      const response = await fetch('/api/timeline/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || null,
          roomId: roomId || null,
          stageId: stageId || null,
          description: description || null,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          isManual: true
        })
      })

      if (response.ok) {
        onClose()
        onSuccess?.()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatStageType = (type: string) => {
    // Use the workflow constants for proper stage names
    return getStageName(type)
  }

  const formatRoomType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-600" />
            Track Time
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'timer' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="timer" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Start Timer
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Project Selector - Required */}
            <div className="space-y-2">
              <Label>Project <span className="text-red-500">*</span></Label>
              <Select value={projectId || ''} onValueChange={setProjectId}>
                <SelectTrigger className={!projectId ? 'border-gray-300' : ''}>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-sm text-gray-500">No projects found. Create a project first.</p>
              )}
            </div>

            {/* Room Selector */}
            {projectId && (
              <div className="space-y-2">
                <Label>Room (optional)</Label>
                <Select value={roomId || 'none'} onValueChange={(v) => setRoomId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Room</SelectItem>
                    {rooms.map((room: any) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name || formatRoomType(room.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stage/Phase Selector */}
            {roomId && (
              <div className="space-y-2">
                <Label>Phase (optional)</Label>
                <Select value={stageId || 'none'} onValueChange={(v) => setStageId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phase..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Phase</SelectItem>
                    {stages.map((stage: any) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {formatStageType(stage.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>What are you working on?</Label>
              <Textarea
                placeholder="Describe your task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <TabsContent value="timer" className="mt-0 space-y-4">
              {/* Custom Start Time Option */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="customStartTime"
                  checked={useCustomStartTime}
                  onChange={(e) => setUseCustomStartTime(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="customStartTime" className="text-sm text-gray-600">
                  I started earlier (custom start time)
                </Label>
              </div>

              {useCustomStartTime && (
                <div className="space-y-2">
                  <Label>When did you start?</Label>
                  <Input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    max={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              <Button 
                onClick={handleStartTimer} 
                disabled={isSubmitting || !!activeEntry || !projectId}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {activeEntry ? 'Timer Already Running' : !projectId ? 'Select a Project' : 'Start Timer'}
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="mt-0 space-y-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                  />
                </div>
              </div>

              <Button 
                onClick={handleAddManualEntry} 
                disabled={isSubmitting || !projectId || !manualDate || !manualStartTime || !manualEndTime}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4 mr-2" />
                )}
                Add Time Entry
              </Button>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
