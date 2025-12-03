'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { 
  CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight,
  Palette, FileImage, FileText, Sofa, LayoutGrid, ImageIcon
} from 'lucide-react'

interface TaskDetail {
  id: string
  roomId: string
  roomName: string
  roomType: string
  stageName: string
  stageType: string
  status: string
  updatedAt: string
  renderingImageUrl?: string | null
  ffeItemsTotal?: number
  ffeItemsCompleted?: number
}

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
  // FFE-specific stats
  ffeItemsTotal?: number
  ffeItemsCompleted?: number
  ffeRoomsWithItems?: number
  ffeRoomsEmpty?: number
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

const PHASE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: any }> = {
  DESIGN_CONCEPT: { 
    label: 'Design Concept', 
    color: '#a657f0',
    bgColor: 'bg-[#a657f0]/10',
    borderColor: 'border-[#a657f0]/30',
    icon: Palette
  },
  THREE_D: { 
    label: '3D Rendering', 
    color: '#f6762e',
    bgColor: 'bg-[#f6762e]/10',
    borderColor: 'border-[#f6762e]/30',
    icon: FileImage
  },
  DRAWINGS: { 
    label: 'Drawings', 
    color: '#6366ea',
    bgColor: 'bg-[#6366ea]/10',
    borderColor: 'border-[#6366ea]/30',
    icon: FileText
  },
  FFE: { 
    label: 'FFE', 
    color: '#e94d97',
    bgColor: 'bg-[#e94d97]/10',
    borderColor: 'border-[#e94d97]/30',
    icon: Sofa
  }
}

export function TaskLevelView({ phases, filters }: Props) {

  // Group rooms by their progress across all phases
  const roomProgress = useMemo(() => {
    const rooms: Record<string, {
      name: string
      type: string
      renderingImageUrl?: string | null
      phases: Record<string, { 
        status: string
        updatedAt: string
        ffeItemsTotal?: number
        ffeItemsCompleted?: number
      }>
    }> = {}

    Object.entries(phases).forEach(([phaseKey, phase]) => {
      phase.tasks.forEach(task => {
        if (!rooms[task.roomId]) {
          rooms[task.roomId] = {
            name: task.roomName,
            type: task.roomType,
            renderingImageUrl: task.renderingImageUrl,
            phases: {}
          }
        }
        // Update rendering URL if we find one (prefer THREE_D phase)
        if (phaseKey === 'THREE_D' && task.renderingImageUrl) {
          rooms[task.roomId].renderingImageUrl = task.renderingImageUrl
        } else if (!rooms[task.roomId].renderingImageUrl && task.renderingImageUrl) {
          rooms[task.roomId].renderingImageUrl = task.renderingImageUrl
        }
        rooms[task.roomId].phases[phaseKey] = {
          status: task.status,
          updatedAt: task.updatedAt,
          ffeItemsTotal: task.ffeItemsTotal,
          ffeItemsCompleted: task.ffeItemsCompleted
        }
      })
    })

    return Object.entries(rooms).map(([id, room]) => {
      const phaseStatuses = Object.values(room.phases)
      const completed = phaseStatuses.filter(p => p.status === 'COMPLETED').length
      const total = phaseStatuses.filter(p => p.status !== 'NOT_APPLICABLE').length
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        id,
        ...room,
        progress,
        completed,
        total
      }
    })
  }, [phases])

  // Apply filters if any
  const filteredRooms = useMemo(() => {
    if (!filters) return roomProgress
    
    return roomProgress.filter(room => {
      if (filters.rooms.length > 0 && !filters.rooms.includes(room.id)) return false
      return true
    })
  }, [roomProgress, filters])

  // Sort rooms by progress
  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => {
      // First, sort by completion (incomplete first)
      if (a.progress === 100 && b.progress !== 100) return 1
      if (a.progress !== 100 && b.progress === 100) return -1
      // Then by progress percentage (descending - more progress first)
      return b.progress - a.progress
    })
  }, [filteredRooms])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#14b8a6]/10 text-[#14b8a6]">
            <CheckCircle className="w-3 h-3" /> Complete
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#6366ea]/10 text-[#6366ea]">
            <Clock className="w-3 h-3" /> In Progress
          </span>
        )
      case 'NOT_APPLICABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            N/A
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f6762e]/10 text-[#f6762e]">
            <AlertCircle className="w-3 h-3" /> Pending
          </span>
        )
    }
  }

  const getProgressColor = (progress: number, completed: number) => {
    if (progress === 100) return '#14b8a6' // Teal - Complete
    if (completed > 0) return '#6366ea'    // Indigo - In Progress (has at least 1 complete)
    return '#f6762e'                       // Orange - Pending (nothing completed yet)
  }

  return (
    <div className="space-y-6">
      {/* Phase Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(PHASE_CONFIG).map(([key, config]) => {
          const phaseData = phases[key]
          if (!phaseData) return null
          
          const PhaseIcon = config.icon
          const isFFE = key === 'FFE'
          
          // For FFE, use the percentage from API (already calculated as room average)
          // For other phases, calculate from completed/total
          const completion = isFFE 
            ? phaseData.percentage
            : (phaseData.total > 0 
                ? Math.round((phaseData.completed / (phaseData.total - (phaseData.notApplicable || 0))) * 100) 
                : 0)
          
          // Generate description text
          let descriptionText = ''
          if (isFFE) {
            const roomsWithItems = phaseData.ffeRoomsWithItems || 0
            const totalRooms = phaseData.total - (phaseData.notApplicable || 0)
            descriptionText = `${roomsWithItems}/${totalRooms} rooms started`
          } else {
            descriptionText = `${phaseData.completed} of ${phaseData.total - (phaseData.notApplicable || 0)} complete`
          }
          
          return (
            <div 
              key={key} 
              className={`bg-white rounded-xl border ${config.borderColor} p-4 hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <PhaseIcon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <span 
                  className="text-lg font-bold"
                  style={{ color: config.color }}
                >
                  {completion}%
                </span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">{config.label}</h4>
              <p className="text-xs text-gray-500">
                {descriptionText}
              </p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${completion}%`,
                    backgroundColor: config.color
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Room Cards Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Room Progress</h3>
            <span className="text-xs text-gray-500">({sortedRooms.length} rooms)</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-[#14b8a6]" />
              Complete
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6366ea]" />
              In Progress
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[#f6762e]" />
              Pending
            </span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedRooms.map(room => {
            const progressColor = getProgressColor(room.progress, room.completed)
            
            // Helper to get phase status icon
            const getPhaseStatusIcon = (phaseKey: string) => {
              const phaseData = room.phases[phaseKey]
              const config = PHASE_CONFIG[phaseKey as keyof typeof PHASE_CONFIG]
              const PhaseIcon = config.icon
              const isFFE = phaseKey === 'FFE'
              
              // For FFE, calculate percentage if items exist
              const ffeHasItems = isFFE && phaseData?.ffeItemsTotal && phaseData.ffeItemsTotal > 0
              const ffePercentage = ffeHasItems 
                ? Math.round((phaseData.ffeItemsCompleted! / phaseData.ffeItemsTotal!) * 100)
                : 0
              
              // Determine status
              let statusColor = '#f6762e' // orange - pending
              let StatusIcon = AlertCircle
              let statusText = ''
              
              if (!phaseData || phaseData.status === 'NOT_APPLICABLE') {
                return (
                  <div key={phaseKey} className="flex items-center gap-1 text-gray-300" title={`${config.label}: N/A`}>
                    <PhaseIcon className="w-3.5 h-3.5" />
                  </div>
                )
              }
              
              if (isFFE) {
                if (ffeHasItems) {
                  if (ffePercentage === 100) {
                    statusColor = '#14b8a6' // teal
                    StatusIcon = CheckCircle
                  } else {
                    statusColor = '#e94d97' // pink
                    statusText = `${ffePercentage}%`
                  }
                }
              } else {
                if (phaseData.status === 'COMPLETED') {
                  statusColor = '#14b8a6' // teal
                  StatusIcon = CheckCircle
                } else if (phaseData.status === 'IN_PROGRESS') {
                  statusColor = '#6366ea' // indigo
                  StatusIcon = Clock
                }
              }
              
              return (
                <div 
                  key={phaseKey} 
                  className="flex items-center gap-0.5" 
                  title={`${config.label}: ${phaseData.status === 'COMPLETED' ? 'Complete' : phaseData.status === 'IN_PROGRESS' ? 'In Progress' : isFFE && ffeHasItems ? `${ffePercentage}%` : 'Pending'}`}
                >
                  <PhaseIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
                  {statusText && (
                    <span className="text-[10px] font-medium" style={{ color: statusColor }}>{statusText}</span>
                  )}
                </div>
              )
            }
            
            return (
              <div 
                key={room.id} 
                className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors bg-white"
              >
                {/* Room Header */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Room Rendering Thumbnail */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                    {room.renderingImageUrl ? (
                      <img
                        src={room.renderingImageUrl}
                        alt={room.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {room.name}
                      </span>
                      {room.progress === 100 && (
                        <CheckCircle className="w-3.5 h-3.5 text-[#14b8a6] flex-shrink-0" />
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${room.progress}%`,
                            backgroundColor: progressColor
                          }}
                        />
                      </div>
                      <span 
                        className="text-xs font-medium"
                        style={{ color: progressColor }}
                      >
                        {room.progress}%
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Phase Status Icons */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  {Object.keys(PHASE_CONFIG).map(phaseKey => getPhaseStatusIcon(phaseKey))}
                </div>
              </div>
            )
          })}
        </div>

        {sortedRooms.length === 0 && (
          <div className="p-8 text-center">
            <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No rooms found</p>
          </div>
        )}
      </div>
    </div>
  )
}
