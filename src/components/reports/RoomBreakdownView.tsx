'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, Clock, AlertCircle, XCircle, Home, Palette, FileImage, FileText, Sofa } from 'lucide-react'
import { ProgressRing } from '@/components/reports/ui/ProgressRing'
import { motion } from 'framer-motion'

interface TaskDetail {
  id: string
  roomId: string
  roomName: string
  roomType: string
  stageName: string
  stageType: string
  status: string
  updatedAt: string
}

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
  tasks: TaskDetail[]
}

interface Props {
  phases: Record<string, PhaseStats>
  filters?: {
    phases: string[]
    rooms: string[]
    statuses: string[]
  }
}

const PHASE_CONFIG: Record<string, { label: string; shortLabel: string; color: string; bgColor: string; icon: any }> = {
  DESIGN_CONCEPT: { label: 'Design Concept', shortLabel: 'Design', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Palette },
  THREE_D: { label: '3D Rendering', shortLabel: '3D', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: FileImage },
  DRAWINGS: { label: 'Drawings', shortLabel: 'Drawings', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: FileText },
  FFE: { label: 'FFE', shortLabel: 'FFE', color: 'text-pink-700', bgColor: 'bg-pink-100', icon: Sofa }
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  COMPLETED: { label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  PENDING: { label: 'Pending', icon: AlertCircle, color: 'bg-orange-100 text-orange-800' },
  NOT_STARTED: { label: 'Not Started', icon: XCircle, color: 'bg-gray-100 text-gray-800' },
  NOT_APPLICABLE: { label: 'N/A', icon: XCircle, color: 'bg-slate-100 text-slate-600' }
}

export function RoomBreakdownView({ phases, filters }: Props) {

  // Filter tasks based on active filters
  const getFilteredTasks = (tasks: TaskDetail[]) => {
    if (!filters) return tasks

    return tasks.filter(task => {
      // Phase filter
      if (filters.phases.length > 0 && !filters.phases.includes(task.stageType)) {
        return false
      }

      // Room filter
      if (filters.rooms.length > 0 && !filters.rooms.includes(task.roomId)) {
        return false
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false
      }

      return true
    })
  }

  // Group all tasks by room first
  const tasksByRoom = useMemo(() => {
    const grouped: Record<string, { 
      roomId: string
      roomName: string
      tasks: Array<TaskDetail & { phaseKey: string }>
    }> = {}

    Object.entries(phases).forEach(([phaseKey, phase]) => {
      const filteredPhaseTasks = getFilteredTasks(phase.tasks)
      
      filteredPhaseTasks.forEach(task => {
        if (!grouped[task.roomId]) {
          grouped[task.roomId] = {
            roomId: task.roomId,
            roomName: task.roomName,
            tasks: []
          }
        }
        grouped[task.roomId].tasks.push({ ...task, phaseKey })
      })
    })

    return Object.values(grouped).sort((a, b) => a.roomName.localeCompare(b.roomName))
  }, [phases, filters])

  // Calculate room stats
  const getRoomStats = (tasks: Array<TaskDetail & { phaseKey: string }>) => {
    const completed = tasks.filter(t => t.status === 'COMPLETED').length
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'NOT_STARTED').length
    const total = tasks.length

    return { completed, inProgress, pending, total }
  }

  // Calculate phase status for a room
  const getPhaseStatus = (tasks: Array<TaskDetail & { phaseKey: string }>, phaseKey: string) => {
    const phaseTasks = tasks.filter(t => t.phaseKey === phaseKey)
    if (phaseTasks.length === 0) return null
    
    const completed = phaseTasks.filter(t => t.status === 'COMPLETED').length
    const inProgress = phaseTasks.filter(t => t.status === 'IN_PROGRESS').length
    const pending = phaseTasks.filter(t => t.status === 'PENDING' || t.status === 'NOT_STARTED').length
    
    return {
      total: phaseTasks.length,
      completed,
      inProgress,
      pending,
      percentage: phaseTasks.length > 0 ? Math.round((completed / phaseTasks.length) * 100) : 0
    }
  }

  if (tasksByRoom.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
        <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">No rooms found with the current filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasksByRoom.map(room => {
        const stats = getRoomStats(room.tasks)
        const completionPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        
        return (
          <motion.div 
            key={room.roomId} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            {/* Room Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold text-gray-900">{room.roomName}</h3>
                </div>
                <ProgressRing 
                  percentage={completionPercentage}
                  size={50}
                  strokeWidth={4}
                  color="auto"
                  showLabel={false}
                />
              </div>
              
              {/* Stats Row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-green-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="font-semibold">{stats.completed}</span>
                </div>
                <div className="flex items-center gap-1 text-blue-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-semibold">{stats.inProgress}</span>
                </div>
                <div className="flex items-center gap-1 text-orange-700">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-semibold">{stats.pending}</span>
                </div>
                <span className="text-gray-500 font-medium">{completionPercentage}%</span>
              </div>
            </div>

            {/* Phase Status Grid */}
            <div className="p-4 space-y-2">
              {['DESIGN_CONCEPT', 'THREE_D', 'DRAWINGS', 'FFE'].map(phaseKey => {
                const config = PHASE_CONFIG[phaseKey]
                const phaseStatus = getPhaseStatus(room.tasks, phaseKey)
                
                if (!phaseStatus) return null
                
                const PhaseIcon = config.icon
                
                return (
                  <div key={phaseKey} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`p-1.5 ${config.bgColor} rounded`}>
                        <PhaseIcon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{config.shortLabel}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {phaseStatus.completed > 0 && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs font-semibold text-green-700">{phaseStatus.completed}</span>
                        </div>
                      )}
                      {phaseStatus.inProgress > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-700">{phaseStatus.inProgress}</span>
                        </div>
                      )}
                      {phaseStatus.pending > 0 && (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-orange-600" />
                          <span className="text-xs font-semibold text-orange-700">{phaseStatus.pending}</span>
                        </div>
                      )}
                      
                      {/* Progress indicator */}
                      <div className="w-12 bg-gray-200 rounded-full h-1.5 ml-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${phaseStatus.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
