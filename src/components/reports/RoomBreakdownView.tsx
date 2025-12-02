'use client'

import { useState, useMemo } from 'react'
import { 
  CheckCircle, Clock, AlertCircle, XCircle, Home, 
  Palette, FileImage, FileText, Sofa, DoorOpen, 
  Navigation, Gamepad2, Bed, Bath, Settings,
  Building2, Search, Utensils, Shirt
} from 'lucide-react'
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

const ROOM_ICONS: Record<string, any> = {
  ENTRANCE: DoorOpen,
  FOYER: Home,
  STAIRCASE: Navigation,
  LIVING_ROOM: Home,
  DINING_ROOM: Home,
  KITCHEN: Home,
  STUDY_ROOM: Settings,
  OFFICE: Settings,
  PLAYROOM: Gamepad2,
  MASTER_BEDROOM: Bed,
  GIRLS_ROOM: Bed,
  BOYS_ROOM: Bed,
  GUEST_BEDROOM: Bed,
  POWDER_ROOM: Bath,
  MASTER_BATHROOM: Bath,
  FAMILY_BATHROOM: Bath,
  GIRLS_BATHROOM: Bath,
  BOYS_BATHROOM: Bath,
  GUEST_BATHROOM: Bath,
  LAUNDRY_ROOM: Settings,
  SUKKAH: Home,
}

const getRoomIcon = (roomType: string) => {
  return ROOM_ICONS[roomType] || Home
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

type ViewMode = 'grid' | 'list'

export function RoomBreakdownView({ phases, filters }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter tasks based on active filters
  const getFilteredTasks = (tasks: TaskDetail[]) => {
    if (!filters) return tasks

    return tasks.filter(task => {
      if (filters.phases.length > 0 && !filters.phases.includes(task.stageType)) return false
      if (filters.rooms.length > 0 && !filters.rooms.includes(task.roomId)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
      return true
    })
  }

  // Group all tasks by room first
  const tasksByRoom = useMemo(() => {
    const grouped: Record<string, { 
      roomId: string
      roomName: string
      roomType: string
      tasks: Array<TaskDetail & { phaseKey: string }>
    }> = {}

    Object.entries(phases).forEach(([phaseKey, phase]) => {
      const filteredPhaseTasks = getFilteredTasks(phase.tasks)
      
      filteredPhaseTasks.forEach(task => {
        if (!grouped[task.roomId]) {
          grouped[task.roomId] = {
            roomId: task.roomId,
            roomName: task.roomName,
            roomType: task.roomType,
            tasks: []
          }
        }
        grouped[task.roomId].tasks.push({ ...task, phaseKey })
      })
    })

    let rooms = Object.values(grouped)
    
    // Filter by search query
    if (searchQuery) {
      rooms = rooms.filter(r => r.roomName.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    return rooms.sort((a, b) => a.roomName.localeCompare(b.roomName))
  }, [phases, filters, searchQuery])

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

  // Calculate summary stats
  const summary = useMemo(() => {
    const total = tasksByRoom.length
    const completed = tasksByRoom.filter(r => {
      const stats = getRoomStats(r.tasks)
      return stats.total > 0 && stats.completed === stats.total
    }).length
    const inProgress = tasksByRoom.filter(r => {
      const stats = getRoomStats(r.tasks)
      return stats.inProgress > 0
    }).length
    return { total, completed, inProgress }
  }, [tasksByRoom])

  if (tasksByRoom.length === 0 && !searchQuery) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">No rooms found</p>
        <p className="text-sm text-gray-500">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and View Toggle */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Room Status Overview</h3>
              <p className="text-sm text-gray-600">{summary.total} rooms • {summary.completed} complete</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-blue-200">
          <span className="text-sm text-gray-600">Phase Legend:</span>
          {Object.entries(PHASE_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 text-sm">
              <div className={`p-1 rounded ${config.bgColor}`}>
                <config.icon className={`w-3 h-3 ${config.color}`} />
              </div>
              <span className="text-gray-700">{config.shortLabel}</span>
            </div>
          ))}
        </div>
      </div>

      {tasksByRoom.length === 0 && searchQuery && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No rooms match "{searchQuery}"</p>
        </div>
      )}

      {/* Room Cards */}
      <div className={viewMode === 'grid' 
        ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
        : 'space-y-3'
      }>
      {tasksByRoom.map(room => {
        const stats = getRoomStats(room.tasks)
        const completionPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        const RoomIcon = getRoomIcon(room.roomType)
        
        const getStatusColor = (pct: number) => {
          if (pct === 100) return 'border-green-300 bg-green-50'
          if (pct >= 50) return 'border-blue-300 bg-blue-50'
          if (pct > 0) return 'border-orange-300 bg-orange-50'
          return 'border-gray-200 bg-white'
        }
        
        // List View
        if (viewMode === 'list') {
          return (
            <motion.div
              key={room.roomId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-white rounded-xl border-2 ${getStatusColor(completionPercentage)} p-4 hover:shadow-lg transition-all duration-200`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2.5 rounded-lg ${completionPercentage === 100 ? 'bg-green-100' : 'bg-indigo-100'}`}>
                    <RoomIcon className={`w-5 h-5 ${completionPercentage === 100 ? 'text-green-600' : 'text-indigo-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{room.roomName}</h3>
                    <p className="text-sm text-gray-500">{stats.total} tasks</p>
                  </div>
                </div>

                {/* Phase Tags */}
                <div className="hidden md:flex items-center gap-2">
                  {['DESIGN_CONCEPT', 'THREE_D', 'DRAWINGS', 'FFE'].map(phaseKey => {
                    const phaseStatus = getPhaseStatus(room.tasks, phaseKey)
                    if (!phaseStatus) return null
                    
                    const config = PHASE_CONFIG[phaseKey]
                    const isComplete = phaseStatus.percentage === 100
                    const isInProgress = phaseStatus.inProgress > 0
                    
                    return (
                      <div
                        key={phaseKey}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isComplete ? 'bg-green-100 text-green-700' : 
                          isInProgress ? 'bg-blue-100 text-blue-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}
                      >
                        <config.icon className="w-3 h-3" />
                        {config.shortLabel}
                        {isComplete && <CheckCircle className="w-3 h-3" />}
                      </div>
                    )
                  })}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      {stats.completed}
                    </span>
                    <span className="flex items-center gap-1 text-blue-700">
                      <Clock className="w-4 h-4" />
                      {stats.inProgress}
                    </span>
                    <span className="flex items-center gap-1 text-orange-700">
                      <AlertCircle className="w-4 h-4" />
                      {stats.pending}
                    </span>
                  </div>
                  <ProgressRing percentage={completionPercentage} size={50} strokeWidth={4} color="auto" showLabel={true} />
                </div>
              </div>
            </motion.div>
          )
        }
        
        // Grid View
        return (
          <motion.div 
            key={room.roomId} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`bg-white rounded-xl border-2 ${getStatusColor(completionPercentage)} p-4 hover:shadow-lg transition-all duration-200`}
          >
            {/* Room Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${completionPercentage === 100 ? 'bg-green-100' : 'bg-indigo-100'}`}>
                  <RoomIcon className={`w-4 h-4 ${completionPercentage === 100 ? 'text-green-600' : 'text-indigo-600'}`} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm truncate max-w-[120px]">{room.roomName}</h3>
              </div>
              {completionPercentage === 100 && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
            
            {/* Progress Ring - Center */}
            <div className="flex justify-center mb-4">
              <ProgressRing percentage={completionPercentage} size={80} strokeWidth={6} color="auto" showLabel={true} />
            </div>
            
            {/* Stats Row - Compact */}
            <div className="flex items-center justify-center gap-4 mb-4 text-xs">
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
            </div>

            {/* Phase Icons - Compact Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {['DESIGN_CONCEPT', 'THREE_D', 'DRAWINGS', 'FFE'].map(phaseKey => {
                const config = PHASE_CONFIG[phaseKey]
                const phaseStatus = getPhaseStatus(room.tasks, phaseKey)
                
                if (!phaseStatus) return (
                  <div key={phaseKey} className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center opacity-40">
                    <config.icon className="w-4 h-4 text-gray-400" />
                  </div>
                )
                
                const isComplete = phaseStatus.percentage === 100
                const isInProgress = phaseStatus.inProgress > 0
                
                return (
                  <div 
                    key={phaseKey} 
                    className={`aspect-square rounded-lg flex items-center justify-center relative transition-all duration-200 ${
                      isComplete ? 'bg-green-100' : isInProgress ? 'bg-blue-100' : 'bg-orange-100'
                    }`}
                    title={`${config.label}: ${phaseStatus.percentage}%`}
                  >
                    <config.icon className={`w-4 h-4 ${
                      isComplete ? 'text-green-700' : isInProgress ? 'text-blue-700' : 'text-orange-700'
                    }`} />
                    {isComplete && (
                      <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
      </div>
    </div>
  )
}
