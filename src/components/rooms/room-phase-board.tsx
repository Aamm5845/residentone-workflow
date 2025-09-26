'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import PhaseCard from './phase-card'
import PhaseAssignmentModal, { BulkPhaseAssignmentModal } from './phase-assignment-modal'
import { 
  ROOM_PHASES,
  type PhaseId,
  type PhaseStatus 
} from '@/lib/constants/room-phases'

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
  status: PhaseStatus
  assignedUser?: TeamMember | null
  completedAt?: Date | null
  startedAt?: Date | null
  dueDate?: Date | null
  stageId?: string | null
}

interface RoomPhaseBoardProps {
  phases: Phase[]
  teamMembers: TeamMember[]
  roomId: string
  projectId: string
  currentUser: any
}

export default function RoomPhaseBoard({
  phases,
  teamMembers,
  roomId,
  projectId,
  currentUser
}: RoomPhaseBoardProps) {
  const router = useRouter()
  const [selectedPhaseForAssignment, setSelectedPhaseForAssignment] = useState<PhaseId | null>(null)
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  // All team members can manage assignments and access settings
  const canManageAssignments = true

  const handleStartPhase = async (phase: Phase) => {
    if (phase.status === 'PENDING') {
      // Start the phase
      setLoading(phase.id)
      try {
        if (phase.stageId) {
          const response = await fetch(`/api/stages/${phase.stageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start' })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to start phase')
          }
          
          // Force a hard refresh to ensure all phase statuses are updated
          // This is important because starting one phase might trigger other phase transitions
          window.location.reload()
        }
      } catch (error) {
        console.error('Error starting phase:', error)
        alert(`Failed to start phase: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setLoading(null)
      }
    } else if (phase.status === 'IN_PROGRESS') {
      // Navigate to existing stage workspace if available
      if (phase.stageId) {
        router.push(`/stages/${phase.stageId}`)
      }
    }
  }

  const handleStatusChange = async (phaseId: PhaseId, newStatus: PhaseStatus) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase?.stageId) return
    
    setLoading(phaseId)
    try {
    const action = newStatus === 'COMPLETE' ? 'complete' : 
                  newStatus === 'IN_PROGRESS' ? 'start' : 
                  newStatus === 'NOT_APPLICABLE' ? 'mark_not_applicable' :
                  newStatus === 'PENDING' ? 'mark_applicable' : 'reopen'
      
      const response = await fetch(`/api/stages/${phase.stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update phase status')
      }
      
      // Force a hard refresh to ensure all related phase transitions are reflected
      // This is especially important when completing phases triggers other phase transitions
      window.location.reload()
    } catch (error) {
      console.error('Error updating phase status:', error)
      alert(`Failed to update phase status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
    }
  }

  const handleAssignPhase = async (memberId: string | null) => {
    if (!selectedPhaseForAssignment) return
    
    const phase = phases.find(p => p.id === selectedPhaseForAssignment)
    if (!phase?.stageId) return
    
    setLoading(selectedPhaseForAssignment)
    try {
      const response = await fetch(`/api/stages/${phase.stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assignedTo: memberId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign phase')
      }
      
      // Refresh to show updated assignment
      router.refresh()
    } catch (error) {
      console.error('Error assigning phase:', error)
      alert(`Failed to assign phase: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
      setSelectedPhaseForAssignment(null)
    }
  }


  const handleBulkAssign = async (assignments: Record<PhaseId, string | null>) => {
    setLoading('bulk')
    try {
      const updatePromises = Object.entries(assignments).map(async ([phaseId, memberId]) => {
        const phase = phases.find(p => p.id === phaseId)
        if (!phase?.stageId) return
        
        const response = await fetch(`/api/stages/${phase.stageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assign', assignedTo: memberId })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to assign ${phaseId}`)
        }
        
        return response
      })
      
      await Promise.all(updatePromises)
      router.refresh()
    } catch (error) {
      console.error('Error bulk assigning phases:', error)
      alert(`Failed to save assignments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
      setShowBulkAssignmentModal(false)
    }
  }

  const handleDueDateChange = async (phaseId: PhaseId, dueDate: Date | null) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase?.stageId) return
    
    setLoading(phaseId)
    try {
      const response = await fetch(`/api/stages/${phase.stageId}/due-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dueDate: dueDate ? dueDate.toISOString() : null 
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update due date')
      }
      
      // Refresh to show updated due date
      router.refresh()
    } catch (error) {
      console.error('Error updating due date:', error)
      
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      // Show more detailed error information
      alert(`Failed to update due date: ${errorMessage}\n\nPlease check the console for more details.`)
      
      // Log additional debug info
      console.error('Debug info:', {
        phaseId,
        stageId: phase?.stageId,
        dueDate,
        isoDate: dueDate?.toISOString()
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project Phases</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage and track all phases for this room
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkAssignmentModal(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Room Settings
          </Button>
        </div>
      </div>

      {/* Phase Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {phases.map((phase, index) => {
          const isDisabled = loading === phase.id || loading === 'bulk'
          
          return (
            <PhaseCard
              key={phase.id}
              phase={phase}
              onStart={() => handleStartPhase(phase)}
              onAssign={() => canManageAssignments && setSelectedPhaseForAssignment(phase.id)}
              onStatusChange={(status) => handleStatusChange(phase.id, status)}
              onDueDateChange={(dueDate) => handleDueDateChange(phase.id, dueDate)}
              disabled={isDisabled}
              showSettings={canManageAssignments}
              onSettings={() => console.log('Phase settings for', phase.id)}
            />
          )
        })}
      </div>

      {/* Assignment Modal */}
      {selectedPhaseForAssignment && (
        <PhaseAssignmentModal
          isOpen={true}
          onClose={() => setSelectedPhaseForAssignment(null)}
          phaseId={selectedPhaseForAssignment}
          currentAssignee={phases.find(p => p.id === selectedPhaseForAssignment)?.assignedUser}
          teamMembers={teamMembers}
          onAssign={handleAssignPhase}
          loading={loading === selectedPhaseForAssignment}
        />
      )}

      {/* Bulk Assignment Modal */}
      <BulkPhaseAssignmentModal
        isOpen={showBulkAssignmentModal}
        onClose={() => setShowBulkAssignmentModal(false)}
        phases={phases}
        teamMembers={teamMembers}
        onBulkAssign={handleBulkAssign}
        loading={loading === 'bulk'}
      />

    </div>
  )
}
