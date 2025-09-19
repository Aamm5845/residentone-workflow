'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  Search, 
  Check, 
  User, 
  UserX
} from 'lucide-react'
import { 
  getPhaseConfig,
  type PhaseId 
} from '@/lib/constants/room-phases'
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

interface PhaseAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  phaseId: PhaseId
  currentAssignee?: TeamMember | null
  teamMembers: TeamMember[]
  onAssign: (memberId: string | null) => void
  loading?: boolean
}

export default function PhaseAssignmentModal({
  isOpen,
  onClose,
  phaseId,
  currentAssignee,
  teamMembers,
  onAssign,
  loading = false
}: PhaseAssignmentModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMember, setSelectedMember] = useState<string | null>(
    currentAssignee?.id || null
  )
  
  const phaseConfig = getPhaseConfig(phaseId)
  
  useEffect(() => {
    setSelectedMember(currentAssignee?.id || null)
  }, [currentAssignee])
  
  if (!isOpen || !phaseConfig) return null

  // Filter team members by role if required, and by search term
  const filteredMembers = teamMembers.filter(member => {
    const matchesRole = !phaseConfig.requiredRole || member.role === phaseConfig.requiredRole
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesRole && matchesSearch
  })

  const handleAssign = () => {
    onAssign(selectedMember)
    onClose()
  }

  const handleUnassign = () => {
    setSelectedMember(null)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-800',
      ADMIN: 'bg-blue-100 text-blue-800', 
      DESIGNER: 'bg-green-100 text-green-800',
      RENDERER: 'bg-orange-100 text-orange-800',
      DRAFTER: 'bg-indigo-100 text-indigo-800',
      FFE: 'bg-pink-100 text-pink-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                {
                  'purple': 'bg-purple-500',
                  'orange': 'bg-orange-500',
                  'blue': 'bg-blue-500',
                  'indigo': 'bg-indigo-500',
                  'pink': 'bg-pink-500'
                }[phaseConfig.color] || 'bg-gray-500'
              )}>
                <span className="text-lg text-white">{phaseConfig.icon}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Assign {phaseConfig.label}
                </h2>
                <p className="text-sm text-gray-600">
                  {phaseConfig.requiredRole 
                    ? `Requires ${phaseConfig.requiredRole} role`
                    : 'Any team member can be assigned'
                  }
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Current Assignment */}
        {currentAssignee && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentAssignee.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(currentAssignee.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Currently assigned to {currentAssignee.name}
                  </p>
                  <p className="text-xs text-blue-600">
                    {currentAssignee.role}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUnassign}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <UserX className="h-4 w-4 mr-1" />
                Unassign
              </Button>
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {filteredMembers.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">
                {searchTerm 
                  ? 'No team members found matching your search'
                  : phaseConfig.requiredRole
                  ? `No team members with ${phaseConfig.requiredRole} role found`
                  : 'No team members found'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className={cn(
                    "px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors",
                    selectedMember === member.id && "bg-blue-50 border-r-4 border-blue-500"
                  )}
                  onClick={() => setSelectedMember(member.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.image || undefined} />
                        <AvatarFallback className="text-sm">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {member.name}
                          </p>
                          <Badge className={`text-xs ${getRoleColor(member.role)}`}>
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {member.email}
                        </p>
                        {member._count?.assignedStages && (
                          <p className="text-xs text-gray-400 mt-1">
                            {member._count.assignedStages} active assignment{member._count.assignedStages !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedMember === member.id && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={loading || (selectedMember === currentAssignee?.id)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Assigning...
                </>
              ) : selectedMember ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Assign Member
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Unassign Phase
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Bulk assignment modal for room settings
interface BulkPhaseAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  phases: Array<{
    id: PhaseId
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE'
    assignedUser?: TeamMember | null
  }>
  teamMembers: TeamMember[]
  onBulkAssign: (assignments: Record<PhaseId, string | null>) => void
  loading?: boolean
}

export function BulkPhaseAssignmentModal({
  isOpen,
  onClose,
  phases,
  teamMembers,
  onBulkAssign,
  loading = false
}: BulkPhaseAssignmentModalProps) {
  const [assignments, setAssignments] = useState<Record<PhaseId, string | null>>({})

  useEffect(() => {
    if (isOpen) {
      const initialAssignments: Record<PhaseId, string | null> = {}
      phases.forEach(phase => {
        initialAssignments[phase.id] = phase.assignedUser?.id || null
      })
      setAssignments(initialAssignments)
    }
  }, [isOpen, phases])

  if (!isOpen) return null

  const handleSave = () => {
    onBulkAssign(assignments)
    onClose()
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
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Phase Assignments
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Assign team members to phases in this room
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Phase Assignments */}
        <div className="flex-1 overflow-y-auto max-h-96">
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
                  Save Assignments
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}