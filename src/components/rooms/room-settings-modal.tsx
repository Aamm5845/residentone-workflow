'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Check, Calendar, Users, Clock } from 'lucide-react'
import { getPhaseConfig, type PhaseId } from '@/lib/constants/room-phases'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  image?: string | null
  _count?: {
    assignedStages?: number
  }
}

interface Phase {
  id: PhaseId
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'NOT_APPLICABLE'
  assignedUser?: TeamMember | null
  dueDate?: Date | null
  stageId?: string | null
}

interface RoomSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  phases: Phase[]
  teamMembers: TeamMember[]
  currentStartDate?: Date | null
  currentDueDate?: Date | null
  onSave: (settings: {
    assignments: Record<PhaseId, string | null>
    startDate: Date | null
    dueDate: Date | null
  }) => void
  loading?: boolean
}

type TabType = 'assignments' | 'dates'

export function RoomSettingsModal({
  isOpen,
  onClose,
  roomId,
  phases,
  teamMembers,
  currentStartDate,
  currentDueDate,
  onSave,
  loading = false
}: RoomSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('assignments')
  const [assignments, setAssignments] = useState<Record<PhaseId, string | null>>({})
  const [startDate, setStartDate] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      // Initialize assignments
      const initialAssignments: Record<PhaseId, string | null> = {}
      phases.forEach(phase => {
        initialAssignments[phase.id] = phase.assignedUser?.id || null
      })
      setAssignments(initialAssignments)

      // Initialize dates
      setStartDate(currentStartDate ? new Date(currentStartDate).toISOString().split('T')[0] : '')
      setDueDate(currentDueDate ? new Date(currentDueDate).toISOString().split('T')[0] : '')
    }
  }, [isOpen, phases, currentStartDate, currentDueDate])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      assignments,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null
    })
  }

  const getEligibleMembers = (phaseId: PhaseId) => {
    const phaseConfig = getPhaseConfig(phaseId)
    if (!phaseConfig) return []
    
    return teamMembers.filter(member => 
      !phaseConfig.requiredRole || member.role === phaseConfig.requiredRole
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Room Settings
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage assignments, dates, and deadlines for this room
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mt-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('assignments')}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'assignments'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Phase Assignments
            </button>
            <button
              onClick={() => setActiveTab('dates')}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'dates'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Dates & Deadlines
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[calc(85vh-220px)]">
          {activeTab === 'assignments' && (
            <div className="divide-y divide-gray-100">
              {phases.map((phase) => {
                const phaseConfig = getPhaseConfig(phase.id)
                const eligibleMembers = getEligibleMembers(phase.id)
                
                if (!phaseConfig) return null

                return (
                  <div key={phase.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          {
                            'purple': 'bg-purple-500',
                            'orange': 'bg-orange-500',
                            'blue': 'bg-blue-500',
                            'indigo': 'bg-indigo-500',
                            'pink': 'bg-pink-500'
                          }[phaseConfig.color] || 'bg-gray-500'
                        )}>
                          <span className="text-sm text-white">{phaseConfig.icon}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {phaseConfig.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {phaseConfig.requiredRole ? `Requires ${phaseConfig.requiredRole}` : 'Any role'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <select
                      value={assignments[phase.id] || ''}
                      onChange={(e) => setAssignments(prev => ({
                        ...prev,
                        [phase.id]: e.target.value || null
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {eligibleMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'dates' && (
            <div className="px-6 py-6 space-y-6">
              {/* Start Date Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">Room Start Date</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Set when work should begin on this room. A warning will appear when entering phases before this date.
                    </p>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white"
                    />
                    {startDate && (
                      <p className="text-xs text-gray-500 mt-2">
                        Work begins: {new Date(startDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Due Date Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">Room Due Date</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Set a deadline for this room. This will automatically update all phase due dates.
                    </p>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-white"
                      min={startDate || undefined}
                    />
                    {dueDate && (
                      <p className="text-xs text-gray-500 mt-2">
                        Due by: {new Date(dueDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    )}
                    {startDate && dueDate && (
                      <p className="text-xs text-blue-600 mt-2">
                        ⏱️ Duration: {Math.ceil((new Date(dueDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <div className="text-amber-600 mt-0.5">💡</div>
                  <div className="flex-1">
                    <p className="text-sm text-amber-900 font-medium mb-1">
                      About Dates
                    </p>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li>• Setting a room due date will update all phase deadlines</li>
                      <li>• Individual phase due dates can still be adjusted separately</li>
                      <li>• Start date warnings help prevent premature work</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
