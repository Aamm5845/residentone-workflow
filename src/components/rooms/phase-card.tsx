'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { 
  Play, 
  Check, 
  UserX, 
  Settings,
  ChevronDown,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Clock,
  X,
  Palette,
  Box,
  Users,
  Ruler,
  Sofa,
  Minus
} from 'lucide-react'
import { 
  getPhaseConfig, 
  getStatusConfig,
  type PhaseId, 
  type PhaseStatus 
} from '@/lib/constants/room-phases'
import { cn } from '@/lib/utils'
import PhaseSettingsMenu from './phase-settings-menu'

interface AssignedUser {
  id: string
  name: string
  image?: string | null
  role: string
}

interface PhaseCardProps {
  phase: {
    id: PhaseId
    status: PhaseStatus
    assignedUser?: AssignedUser | null
    completedAt?: Date | null
    startedAt?: Date | null
    startDate?: Date | null
    dueDate?: Date | null
    stageId?: string | null
  }
  onStart: () => void
  onAssign: () => void
  onStatusChange: (status: PhaseStatus) => void
  onStartDateChange?: (startDate: Date | null) => void
  onDueDateChange?: (dueDate: Date | null) => void
  className?: string
  disabled?: boolean
  showSettings?: boolean
  onSettings?: () => void
}

export default function PhaseCard({ 
  phase, 
  onStart, 
  onAssign, 
  onStatusChange,
  onStartDateChange,
  onDueDateChange,
  className,
  disabled = false,
  showSettings = false,
  onSettings
}: PhaseCardProps) {
  const phaseConfig = getPhaseConfig(phase.id)
  const statusConfig = getStatusConfig(phase.status)
  
  if (!phaseConfig) return null
  
  const canStart = phase.status === 'PENDING'
  const isActive = phase.status === 'IN_PROGRESS'
  const isComplete = phase.status === 'COMPLETE'
  const isNotApplicable = phase.status === 'NOT_APPLICABLE'
  
  // Due date logic — computed client-side only to avoid hydration mismatch
  const [isOverdue, setIsOverdue] = useState(false)
  const [isDueSoon, setIsDueSoon] = useState(false)

  useEffect(() => {
    if (phase.dueDate && !isComplete) {
      const now = new Date()
      const due = new Date(phase.dueDate)
      setIsOverdue(now > due)
      setIsDueSoon(now < due && (due.getTime() - now.getTime()) <= 3 * 24 * 60 * 60 * 1000)
    } else {
      setIsOverdue(false)
      setIsDueSoon(false)
    }
  }, [phase.dueDate, isComplete])
  
  const [showStartDateInput, setShowStartDateInput] = useState(false)
  const [tempStartDate, setTempStartDate] = useState(
    phase.startDate ? new Date(phase.startDate).toISOString().split('T')[0] : ''
  )
  
  const [showDueDateInput, setShowDueDateInput] = useState(false)
  const [tempDueDate, setTempDueDate] = useState(
    phase.dueDate ? new Date(phase.dueDate).toISOString().split('T')[0] : ''
  )

  const handleStartDateSave = () => {
    if (onStartDateChange) {
      const newStartDate = tempStartDate ? new Date(tempStartDate) : null
      onStartDateChange(newStartDate)
    }
    setShowStartDateInput(false)
  }
  
  const handleStartDateCancel = () => {
    setTempStartDate(phase.startDate ? new Date(phase.startDate).toISOString().split('T')[0] : '')
    setShowStartDateInput(false)
  }
  
  const handleDueDateSave = () => {
    if (onDueDateChange) {
      const newDueDate = tempDueDate ? new Date(tempDueDate) : null
      onDueDateChange(newDueDate)
    }
    setShowDueDateInput(false)
  }
  
  const handleDueDateCancel = () => {
    setTempDueDate(phase.dueDate ? new Date(phase.dueDate).toISOString().split('T')[0] : '')
    setShowDueDateInput(false)
  }

  const getStatusBorderClass = () => {
    if (isComplete) return "border-green-400 bg-gradient-to-br from-green-50 to-green-100"
    if (isNotApplicable) return "border-slate-300 bg-slate-50 opacity-75"
    if (isOverdue) return "border-red-500 bg-gradient-to-br from-red-50 to-red-100"
    if (isDueSoon) return "border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100"
    if (isActive) {
      // Use brand colors for active phases
      const activeBorders: Record<string, string> = {
        purple: 'border-[#a657f0]/40 bg-gradient-to-br from-[#a657f0]/5 to-[#a657f0]/15',
        orange: 'border-[#f6762e]/40 bg-gradient-to-br from-[#f6762e]/5 to-[#f6762e]/15',
        teal: 'border-[#14b8a6]/40 bg-gradient-to-br from-[#14b8a6]/5 to-[#14b8a6]/15',
        blue: 'border-[#14b8a6]/40 bg-gradient-to-br from-[#14b8a6]/5 to-[#14b8a6]/15',
        indigo: 'border-[#6366ea]/40 bg-gradient-to-br from-[#6366ea]/5 to-[#6366ea]/15',
        pink: 'border-[#e94d97]/40 bg-gradient-to-br from-[#e94d97]/5 to-[#e94d97]/15'
      }
      return activeBorders[phaseConfig.color] || 'border-gray-400 bg-gray-50'
    }
    return "border-gray-200 bg-white hover:bg-gray-50"
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div 
      className={cn(
        "relative group rounded-xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]",
        getStatusBorderClass(),
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          {/* Phase Icon & Title */}
          <div className="flex items-center space-x-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm",
              isComplete ? "bg-green-500" :
              isNotApplicable ? "bg-slate-400" : {
                'purple': 'bg-[#a657f0]',
                'orange': 'bg-[#f6762e]',
                'teal': 'bg-[#14b8a6]',
                'blue': 'bg-[#14b8a6]',
                'indigo': 'bg-[#6366ea]',
                'pink': 'bg-[#e94d97]'
              }[phaseConfig.color] || 'bg-gray-500',
              "transition-all duration-200"
            )}>
              {isComplete ? (
                <Check className="w-5 h-5 text-white" />
              ) : isNotApplicable ? (
                <Minus className="w-5 h-5 text-white" />
              ) : (
                (() => {
                  // Map phase IDs to Lucide icons
                  const PhaseIcon = {
                    'DESIGN_CONCEPT': Palette,
                    'RENDERING': Box,
                    'CLIENT_APPROVAL': Users,
                    'DRAWINGS': Ruler,
                    'FFE': Sofa
                  }[phase.id] || Palette
                  return <PhaseIcon className="w-5 h-5 text-white" />
                })()
              )}
            </div>
            
            <div>
              <h3 className={cn(
                "text-base font-semibold",
                isComplete ? "text-green-700" :
                isNotApplicable ? "text-slate-600" :
                "text-gray-800"
              )}>
                {phaseConfig.label}
              </h3>
            </div>
          </div>

          {/* Status & Settings */}
          <div className="flex items-center space-x-2">
            {showSettings && (
              <PhaseSettingsMenu
                phaseId={phase.id}
                phaseName={phaseConfig.label}
                currentStatus={phase.status}
                onStatusChange={onStatusChange}
                disabled={disabled}
                stageId={phase.stageId}
              />
            )}
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className="mb-4">
          <div className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
            isComplete ? "bg-green-100 text-green-800 border-green-200" :
            isNotApplicable ? "bg-slate-100 text-slate-700 border-slate-200" :
            isActive ? "bg-blue-100 text-blue-800 border-blue-200" :
            "bg-gray-100 text-gray-700 border-gray-200"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full mr-2",
              isComplete ? "bg-green-500" :
              isNotApplicable ? "bg-slate-500" :
              isActive ? "bg-blue-500 animate-pulse" :
              "bg-gray-400"
            )} />
            {statusConfig.label}
          </div>
        </div>

        {/* Assignee Section */}
        <div className="mb-4">
          <div className={cn(
            "flex items-center space-x-2",
            isNotApplicable && "opacity-60"
          )}>
            {phase.assignedUser ? (
              <>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={phase.assignedUser.image || undefined} />
                  <AvatarFallback className="text-[10px] bg-gray-100">
                    {getInitials(phase.assignedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  "text-sm",
                  isNotApplicable ? "text-slate-600" : "text-gray-700"
                )}>
                  {phase.assignedUser.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <div className={cn(
                  "h-6 w-6 rounded-full border border-dashed flex items-center justify-center",
                  isNotApplicable ? "border-slate-300" : "border-gray-300"
                )}>
                  <UserX className={cn(
                    "h-3 w-3",
                    isNotApplicable ? "text-slate-400" : "text-gray-400"
                  )} />
                </div>
                <span className={cn(
                  "text-sm",
                  isNotApplicable ? "text-slate-500" : "text-gray-500"
                )}>—</span>
              </>
            )}
          </div>
        </div>

        {/* Dates Section - Combined Start & Due */}
        {!isNotApplicable && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Schedule</span>
              {!showStartDateInput && !showDueDateInput && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowStartDateInput(true)}
                  className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600 rounded-md"
                  title="Edit dates"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {showStartDateInput || showDueDateInput ? (
              <div className="space-y-2">
                {/* Start Date Input */}
                <div>
                  <label className="text-xs text-gray-600 flex items-center space-x-1 mb-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Start</span>
                  </label>
                  <Input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
                
                {/* Due Date Input */}
                <div>
                  <label className="text-xs text-gray-600 flex items-center space-x-1 mb-1">
                    <Calendar className="w-3 h-3 text-purple-500" />
                    <span>Due</span>
                  </label>
                  <Input
                    type="date"
                    value={tempDueDate}
                    onChange={(e) => setTempDueDate(e.target.value)}
                    className="text-sm h-8"
                    min={tempStartDate || undefined}
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    onClick={() => {
                      handleStartDateSave()
                      handleDueDateSave()
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                  >
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      handleStartDateCancel()
                      handleDueDateCancel()
                    }}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Start Date Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span className="text-gray-600">Start:</span>
                  </div>
                  {phase.startDate ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-blue-700">
                        {new Date(phase.startDate).toLocaleDateString('en-US')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (onStartDateChange) {
                            onStartDateChange(null)
                          }
                        }}
                        className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Remove start date"
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not set</span>
                  )}
                </div>
                
                {/* Due Date Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs">
                    <Calendar className="w-3 h-3 text-purple-500" />
                    <span className="text-gray-600">Due:</span>
                  </div>
                  {phase.dueDate ? (
                    <div className="flex items-center space-x-1">
                      <span className={cn(
                        "text-xs font-medium",
                        isOverdue ? "text-red-700" :
                        isDueSoon ? "text-yellow-700" :
                        "text-purple-700"
                      )}>
                        {new Date(phase.dueDate).toLocaleDateString('en-US')}
                      </span>
                      {isOverdue && <AlertTriangle className="w-3 h-3 text-red-600" />}
                      {isDueSoon && !isOverdue && <Clock className="w-3 h-3 text-yellow-600" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (onDueDateChange) {
                            onDueDateChange(null)
                          }
                        }}
                        className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Remove due date"
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not set</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Area */}
        <div>
          {canStart && (
            <Button 
              onClick={onStart}
              className={cn(
                "w-full font-medium text-white shadow-sm hover:shadow-md transition-all duration-200",
                {
                  'purple': 'bg-[#a657f0] hover:bg-[#a657f0]/90',
                  'orange': 'bg-[#f6762e] hover:bg-[#f6762e]/90',
                  'teal': 'bg-[#14b8a6] hover:bg-[#14b8a6]/90',
                  'blue': 'bg-[#14b8a6] hover:bg-[#14b8a6]/90',
                  'indigo': 'bg-[#6366ea] hover:bg-[#6366ea]/90',
                  'pink': 'bg-[#e94d97] hover:bg-[#e94d97]/90'
                }[phaseConfig.color] || 'bg-gray-500 hover:bg-gray-600'
              )}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Phase
            </Button>
          )}
          
          {isActive && (
            <div className="space-y-2">
              <Button 
                onClick={onStart}
                variant="outline"
                className="w-full font-medium transition-all duration-200"
              >
                <Play className="w-4 h-4 mr-2" />
                Open Workspace
              </Button>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => onStatusChange('COMPLETE')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Complete
                </Button>
                <Button 
                  onClick={() => onStatusChange('PENDING')}
                  variant="outline"
                  className="flex-1 text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          )}
          
          {isComplete && (
            <div className="text-center py-2">
              <div className="flex items-center justify-center space-x-2 text-green-600 mb-2">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Completed</span>
              </div>
              {phase.completedAt && (
                <p className="text-xs text-gray-500 mb-3">
                  {new Date(phase.completedAt).toLocaleDateString('en-US')}
                </p>
              )}
              <div className="space-y-2">
                <Button 
                  onClick={onStart}
                  variant="outline"
                  className="w-full font-medium transition-all duration-200"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Open Workspace
                </Button>
                <Button 
                  onClick={() => onStatusChange('IN_PROGRESS')}
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-gray-500 hover:text-gray-700 w-full"
                >
                  Reopen Phase
                </Button>
              </div>
            </div>
          )}
          
          {isNotApplicable && (
            <div className="text-center py-3">
              <div className="flex items-center justify-center space-x-2 text-slate-500 mb-3">
                <span className="text-lg">➖</span>
                <span className="font-medium text-sm">Not Applicable</span>
              </div>
              <p className="text-xs text-slate-500 px-2 mb-3">
                This phase is not needed for this room
              </p>
              <Button 
                onClick={() => onStatusChange('PENDING')}
                variant="outline"
                size="sm"
                className="text-slate-600 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Reactivate Phase
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Supporting component for status dropdown
interface StatusDropdownProps {
  currentStatus: PhaseStatus
  onStatusChange: (status: PhaseStatus) => void
  disabled?: boolean
}

export function StatusDropdown({ 
  currentStatus, 
  onStatusChange, 
  disabled = false 
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const currentConfig = getStatusConfig(currentStatus)
  
  const statusOptions: PhaseStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'NOT_APPLICABLE']
  
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "justify-between min-w-[120px]",
          currentConfig.bgClass,
          currentConfig.textClass
        )}
      >
        <span className="flex items-center space-x-1">
          <span>{currentConfig.icon}</span>
          <span>{currentConfig.label}</span>
        </span>
        <ChevronDown className="h-4 w-4 ml-2" />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 z-10">
          {statusOptions.map((status) => {
            const config = getStatusConfig(status)
            return (
              <button
                key={status}
                onClick={() => {
                  onStatusChange(status)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2",
                  status === currentStatus && "bg-gray-50 font-medium"
                )}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
      )}
      
      {/* Click outside overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
