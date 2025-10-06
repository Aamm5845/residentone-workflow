'use client'

import { useState } from 'react'
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
  Clock
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
    dueDate?: Date | null
    stageId?: string | null
  }
  onStart: () => void
  onAssign: () => void
  onStatusChange: (status: PhaseStatus) => void
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
  
  // Due date logic
  const isOverdue = phase.dueDate && new Date() > new Date(phase.dueDate) && !isComplete
  const isDueSoon = phase.dueDate && 
    new Date() < new Date(phase.dueDate) && 
    (new Date(phase.dueDate).getTime() - new Date().getTime()) <= (3 * 24 * 60 * 60 * 1000) // 3 days
  
  const [showDueDateInput, setShowDueDateInput] = useState(false)
  const [tempDueDate, setTempDueDate] = useState(
    phase.dueDate ? new Date(phase.dueDate).toISOString().split('T')[0] : ''
  )

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
      const activeBorders: Record<string, string> = {
        purple: 'border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100',
        orange: 'border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100',
        blue: 'border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100',
        indigo: 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-indigo-100',
        pink: 'border-pink-400 bg-gradient-to-br from-pink-50 to-pink-100'
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
                'purple': 'bg-purple-500',
                'orange': 'bg-orange-500',
                'blue': 'bg-blue-500',
                'indigo': 'bg-indigo-500',
                'pink': 'bg-pink-500'
              }[phaseConfig.color] || 'bg-gray-500',
              "transition-all duration-200"
            )}>
              <span className="text-lg text-white">
                {isComplete ? '✅' : isNotApplicable ? '➖' : phaseConfig.icon}
              </span>
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
          <div className="flex items-center justify-between">
            <div className={cn(
              "flex items-center space-x-2.5",
              isNotApplicable && "opacity-60"
            )}>
              {phase.assignedUser ? (
                <>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={phase.assignedUser.image || undefined} />
                    <AvatarFallback className="text-xs bg-gray-100">
                      {getInitials(phase.assignedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      isNotApplicable ? "text-slate-600" : "text-gray-800"
                    )}>
                      {phase.assignedUser.name}
                    </p>
                    <p className={cn(
                      "text-xs",
                      isNotApplicable ? "text-slate-500" : "text-gray-500"
                    )}>
                      {phase.assignedUser.role}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={cn(
                    "h-7 w-7 rounded-full border border-dashed flex items-center justify-center",
                    isNotApplicable ? "border-slate-300" : "border-gray-300"
                  )}>
                    <UserX className={cn(
                      "h-3 w-3",
                      isNotApplicable ? "text-slate-400" : "text-gray-400"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm",
                      isNotApplicable ? "text-slate-500" : "text-gray-500"
                    )}>Unassigned</p>
                  </div>
                </>
              )}
            </div>

            {/* Assignment Button */}
            {!isNotApplicable && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onAssign}
                className="p-1 h-7 w-7 text-gray-400 hover:text-gray-600 rounded-md"
              >
                <Settings className="h-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Due Date Section */}
        {!isNotApplicable && (
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Due Date</span>
              </div>
              {!showDueDateInput && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDueDateInput(true)}
                  className="p-1 h-7 w-7 text-gray-400 hover:text-gray-600 rounded-md"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {showDueDateInput ? (
              <div className="mt-2 space-y-2">
                <Input
                  type="date"
                  value={tempDueDate}
                  onChange={(e) => setTempDueDate(e.target.value)}
                  className="text-sm"
                  placeholder="Set due date"
                />
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    onClick={handleDueDateSave}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleDueDateCancel}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                {phase.dueDate ? (
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium",
                      isOverdue ? "bg-red-100 text-red-800" :
                      isDueSoon ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {isOverdue && <AlertTriangle className="w-3 h-3" />}
                      {isDueSoon && <Clock className="w-3 h-3" />}
                      <span>{new Date(phase.dueDate).toLocaleDateString()}</span>
                    </div>
                    {isOverdue && (
                      <span className="text-xs text-red-600 font-medium">
                        Overdue
                      </span>
                    )}
                    {isDueSoon && !isOverdue && (
                      <span className="text-xs text-yellow-600 font-medium">
                        Due Soon
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No due date set
                  </div>
                )}
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
                  'purple': 'bg-purple-500 hover:bg-purple-600',
                  'orange': 'bg-orange-500 hover:bg-orange-600',
                  'blue': 'bg-blue-500 hover:bg-blue-600',
                  'indigo': 'bg-indigo-500 hover:bg-indigo-600',
                  'pink': 'bg-pink-500 hover:bg-pink-600'
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
                  {new Date(phase.completedAt).toLocaleDateString()}
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
