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

  const canManageAssignments = ['OWNER', 'ADMIN'].includes(currentUser.role)

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
          
          if (!response.ok) throw new Error('Failed to start phase')
          
          // Refresh the page to show updated state
          router.refresh()
        }
      } catch (error) {
        console.error('Error starting phase:', error)
        alert('Failed to start phase. Please try again.')
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
                    newStatus === 'IN_PROGRESS' ? 'start' : 'reopen'
      
      const response = await fetch(`/api/stages/${phase.stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (!response.ok) throw new Error('Failed to update phase status')
      
      router.refresh()
    } catch (error) {
      console.error('Error updating phase status:', error)
      alert('Failed to update phase status. Please try again.')
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
      
      if (!response.ok) throw new Error('Failed to assign phase')
      
      router.refresh()
    } catch (error) {
      console.error('Error assigning phase:', error)
      alert('Failed to assign phase. Please try again.')
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
        
        return fetch(`/api/stages/${phase.stageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assign', assignedTo: memberId })
        })
      })
      
      await Promise.all(updatePromises)
      router.refresh()
    } catch (error) {
      console.error('Error bulk assigning phases:', error)
      alert('Failed to save assignments. Please try again.')
    } finally {
      setLoading(null)
      setShowBulkAssignmentModal(false)
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
        
        {canManageAssignments && (
          <Button 
            variant="outline" 
            onClick={() => setShowBulkAssignmentModal(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Room Settings
          </Button>
        )}
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