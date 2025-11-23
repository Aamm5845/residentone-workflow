'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, XCircle, Palette, Sparkles, FileImage, FileText, Sofa } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

const PHASE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; gradient: string }> = {
  DESIGN_CONCEPT: { label: 'Design Concept', color: 'text-purple-700', bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100', icon: Palette, gradient: 'from-purple-500 to-purple-700' },
  THREE_D: { label: '3D Rendering', color: 'text-orange-700', bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100', icon: FileImage, gradient: 'from-orange-500 to-orange-700' },
  DRAWINGS: { label: 'Drawings', color: 'text-indigo-700', bgColor: 'bg-gradient-to-br from-indigo-50 to-indigo-100', icon: FileText, gradient: 'from-indigo-500 to-indigo-700' },
  FFE: { label: 'FFE', color: 'text-pink-700', bgColor: 'bg-gradient-to-br from-pink-50 to-pink-100', icon: Sofa, gradient: 'from-pink-500 to-pink-700' }
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  COMPLETED: { label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  PENDING: { label: 'Pending', icon: AlertCircle, color: 'bg-orange-100 text-orange-800' },
  NOT_STARTED: { label: 'Not Started', icon: XCircle, color: 'bg-gray-100 text-gray-800' },
  NOT_APPLICABLE: { label: 'N/A', icon: XCircle, color: 'bg-slate-100 text-slate-600' }
}

export function TaskLevelView({ phases, filters }: Props) {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})

  const togglePhase = (phaseKey: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseKey]: !prev[phaseKey] }))
  }

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

  // Group tasks by room
  const groupTasksByRoom = (tasks: TaskDetail[]) => {
    const grouped: Record<string, TaskDetail[]> = {}
    
    tasks.forEach(task => {
      if (!grouped[task.roomId]) {
        grouped[task.roomId] = []
      }
      grouped[task.roomId].push(task)
    })

    return grouped
  }

  return (
    <div className="space-y-6">
      {Object.entries(phases).map(([phaseKey, phase]) => {
        const config = PHASE_CONFIG[phaseKey]
        if (!config) return null
        
        // Skip if all tasks are explicitly marked as NOT_APPLICABLE
        if (phase.total > 0 && phase.total === phase.notApplicable) return null

        const filteredTasks = getFilteredTasks(phase.tasks)
        if (filteredTasks.length === 0 && filters) return null

        const groupedTasks = groupTasksByRoom(filteredTasks)
        const isExpanded = expandedPhases[phaseKey]
        const PhaseIcon = config.icon

        return (
          <motion.div 
            key={phaseKey} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`${config.bgColor} rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300`}
          >
            {/* Phase Header */}
            <button
              onClick={() => togglePhase(phaseKey)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/30 transition-all duration-200 group"
            >
              <div className="flex items-center gap-6">
                {/* Phase Icon */}
                <div className={`p-4 bg-gradient-to-br ${config.gradient} rounded-xl shadow-md group-hover:scale-110 transition-transform duration-200`}>
                  <PhaseIcon className="w-8 h-8 text-white" />
                </div>
                
                <div className="text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`text-2xl font-bold ${config.color}`}>
                      {config.label}
                    </div>
                    <Sparkles className={`w-5 h-5 ${config.color}`} />
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full font-medium shadow-sm">
                      <CheckCircle className="w-4 h-4" />
                      {phase.completed}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full font-medium shadow-sm">
                      <Clock className="w-4 h-4" />
                      {phase.inProgress}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full font-medium shadow-sm">
                      <AlertCircle className="w-4 h-4" />
                      {phase.pending}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Progress Bar */}
                <div className="hidden lg:block w-32">
                  <div className="text-xs text-gray-600 mb-1 text-right">{phase.completed}/{phase.total - phase.notApplicable}</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                      style={{ width: `${phase.percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-4xl font-bold text-gray-900">
                  {phase.percentage}%
                </div>
                
                {isExpanded ? (
                  <ChevronUp className="w-7 h-7 text-gray-600" />
                ) : (
                  <ChevronDown className="w-7 h-7 text-gray-600" />
                )}
              </div>
            </button>

            {/* Expandable Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-6 pb-6 space-y-4 bg-white/50"
                >
                  {Object.entries(groupedTasks).map(([roomId, roomTasks]) => {
                    const roomName = roomTasks[0].roomName

                    return (
                      <div key={roomId} className="bg-white rounded-xl border-2 border-gray-200 p-5 shadow-md hover:shadow-lg transition-shadow duration-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-lg text-gray-900">{roomName}</h4>
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                            {roomTasks.length} {roomTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {roomTasks.map((task, index) => {
                            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.NOT_STARTED
                            const Icon = statusConfig.icon
                            const updatedDate = new Date(task.updatedAt).toLocaleDateString()
                            
                            // Format stage name properly
                            const stageNameMap: Record<string, string> = {
                              'DESIGN_CONCEPT': 'Design Concept',
                              'THREE_D': '3D Rendering',
                              'DRAWINGS': 'Drawings',
                              'FFE': 'FFE'
                            }
                            const displayName = stageNameMap[task.stageName] || task.stageName.replace(/_/g, ' ')

                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:from-gray-100 hover:to-gray-50 transition-all duration-200 border border-gray-200 shadow-sm hover:shadow-md"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Icon className={`w-6 h-6 ${statusConfig.color.includes('green') ? 'text-green-600' : statusConfig.color.includes('blue') ? 'text-blue-600' : statusConfig.color.includes('orange') ? 'text-orange-600' : 'text-gray-600'}`} />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 text-base">{displayName}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Updated {updatedDate}</div>
                                  </div>
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${statusConfig.color} shadow-sm`}>
                                  {statusConfig.label}
                                </span>
                              </motion.div>
                          )
                          })}
                        </div>
                      </div>
                  )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
