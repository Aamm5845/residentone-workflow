'use client'

import { useState, useMemo } from 'react'
import { 
  ChevronDown, ChevronRight, CheckCircle, Clock, AlertCircle, XCircle, 
  Palette, FileImage, FileText, Sofa, Target, TrendingUp, 
  ArrowRight, Filter
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProgressRing } from '@/components/reports/ui/ProgressRing'

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

const PHASE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: any; gradient: string }> = {
  DESIGN_CONCEPT: { 
    label: 'Design Concept', 
    color: 'text-purple-700', 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-200',
    icon: Palette, 
    gradient: 'from-purple-500 to-purple-600' 
  },
  THREE_D: { 
    label: '3D Rendering', 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-50', 
    borderColor: 'border-orange-200',
    icon: FileImage, 
    gradient: 'from-orange-500 to-orange-600' 
  },
  DRAWINGS: { 
    label: 'Drawings', 
    color: 'text-indigo-700', 
    bgColor: 'bg-indigo-50', 
    borderColor: 'border-indigo-200',
    icon: FileText, 
    gradient: 'from-indigo-500 to-indigo-600' 
  },
  FFE: { 
    label: 'FFE', 
    color: 'text-pink-700', 
    bgColor: 'bg-pink-50', 
    borderColor: 'border-pink-200',
    icon: Sofa, 
    gradient: 'from-pink-500 to-pink-600' 
  }
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; bgColor: string; textColor: string; dotColor: string }> = {
  COMPLETED: { label: 'Completed', icon: CheckCircle, bgColor: 'bg-green-50', textColor: 'text-green-700', dotColor: 'bg-green-500' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, bgColor: 'bg-blue-50', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
  PENDING: { label: 'Pending', icon: AlertCircle, bgColor: 'bg-orange-50', textColor: 'text-orange-700', dotColor: 'bg-orange-500' },
  NOT_STARTED: { label: 'Not Started', icon: XCircle, bgColor: 'bg-gray-50', textColor: 'text-gray-600', dotColor: 'bg-gray-400' },
  NOT_APPLICABLE: { label: 'N/A', icon: XCircle, bgColor: 'bg-slate-50', textColor: 'text-slate-500', dotColor: 'bg-slate-400' }
}

function PhaseCard({ 
  phaseKey, 
  phase, 
  config, 
  isExpanded, 
  onToggle,
  filteredTasks 
}: { 
  phaseKey: string
  phase: PhaseStats
  config: typeof PHASE_CONFIG[string]
  isExpanded: boolean
  onToggle: () => void
  filteredTasks: TaskDetail[]
}) {
  const groupedTasks = useMemo(() => {
    const grouped: Record<string, TaskDetail[]> = {}
    filteredTasks.forEach(task => {
      if (!grouped[task.roomId]) grouped[task.roomId] = []
      grouped[task.roomId].push(task)
    })
    return grouped
  }, [filteredTasks])

  const effectiveTotal = phase.total - phase.notApplicable
  const PhaseIcon = config.icon

  return (
    <div className={`bg-white rounded-xl border-2 ${config.borderColor} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
      {/* Phase Header */}
      <button
        onClick={onToggle}
        className={`w-full p-5 flex items-center gap-4 hover:${config.bgColor} transition-colors duration-200`}
      >
        {/* Icon */}
        <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-md flex-shrink-0`}>
          <PhaseIcon className="w-6 h-6 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <h3 className={`text-xl font-bold ${config.color}`}>{config.label}</h3>
          <div className="flex items-center gap-4 mt-2">
            <StatusBadge count={phase.completed} type="completed" />
            <StatusBadge count={phase.inProgress} type="inProgress" />
            <StatusBadge count={phase.pending} type="pending" />
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm text-gray-500">{phase.completed} / {effectiveTotal}</p>
            <p className="text-xs text-gray-400">tasks completed</p>
          </div>
          <ProgressRing 
            percentage={phase.percentage} 
            size={60} 
            strokeWidth={5} 
            color="auto" 
            showLabel={true}
          />
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`border-t ${config.borderColor}`}
          >
            <div className={`p-5 ${config.bgColor} space-y-4`}>
              {Object.entries(groupedTasks).map(([roomId, tasks]) => (
                <RoomTaskGroup 
                  key={roomId} 
                  roomName={tasks[0].roomName} 
                  tasks={tasks} 
                />
              ))}
              {Object.keys(groupedTasks).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Filter className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No tasks match the current filters</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusBadge({ count, type }: { count: number; type: 'completed' | 'inProgress' | 'pending' }) {
  const styles = {
    completed: 'bg-green-100 text-green-700',
    inProgress: 'bg-blue-100 text-blue-700',
    pending: 'bg-orange-100 text-orange-700'
  }
  const icons = {
    completed: CheckCircle,
    inProgress: Clock,
    pending: AlertCircle
  }
  const Icon = icons[type]

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${styles[type]}`}>
      <Icon className="w-3.5 h-3.5" />
      {count}
    </div>
  )
}

function RoomTaskGroup({ roomName, tasks }: { roomName: string; tasks: TaskDetail[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">{roomName}</h4>
        <span className="text-sm text-gray-500">{tasks.length} tasks</span>
      </div>
      <div className="divide-y divide-gray-100">
        {tasks.map(task => {
          const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.NOT_STARTED
          const StatusIcon = statusConfig.icon
          
          const stageLabels: Record<string, string> = {
            'DESIGN_CONCEPT': 'Design Concept',
            'THREE_D': '3D Rendering',
            'DRAWINGS': 'Drawings',
            'FFE': 'FFE'
          }

          return (
            <div 
              key={task.id} 
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                <div>
                  <p className="font-medium text-gray-900">
                    {stageLabels[task.stageName] || task.stageName.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated {new Date(task.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                {statusConfig.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TaskLevelView({ phases, filters }: Props) {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})

  const togglePhase = (phaseKey: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseKey]: !prev[phaseKey] }))
  }

  const getFilteredTasks = (tasks: TaskDetail[]) => {
    if (!filters) return tasks

    return tasks.filter(task => {
      if (filters.phases.length > 0 && !filters.phases.includes(task.stageType)) return false
      if (filters.rooms.length > 0 && !filters.rooms.includes(task.roomId)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
      return true
    })
  }

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalCompleted = 0, totalInProgress = 0, totalPending = 0, total = 0
    
    Object.values(phases).forEach(phase => {
      totalCompleted += phase.completed
      totalInProgress += phase.inProgress
      totalPending += phase.pending
      total += phase.total - phase.notApplicable
    })

    return { totalCompleted, totalInProgress, totalPending, total }
  }, [phases])

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl">
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Phase Progress Overview</h3>
              <p className="text-sm text-gray-600">Click on any phase to see detailed room breakdown</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary.totalCompleted}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.totalInProgress}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{summary.totalPending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Phase Cards */}
      <div className="space-y-4">
        {Object.entries(phases).map(([phaseKey, phase]) => {
          const config = PHASE_CONFIG[phaseKey]
          if (!config) return null
          if (phase.total > 0 && phase.total === phase.notApplicable) return null

          const filteredTasks = getFilteredTasks(phase.tasks)

          return (
            <PhaseCard
              key={phaseKey}
              phaseKey={phaseKey}
              phase={phase}
              config={config}
              isExpanded={expandedPhases[phaseKey] || false}
              onToggle={() => togglePhase(phaseKey)}
              filteredTasks={filteredTasks}
            />
          )
        })}
      </div>
    </div>
  )
}
