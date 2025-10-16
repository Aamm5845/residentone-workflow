'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import PhaseCard from './phase-card'
import PhaseAssignmentModal, { BulkPhaseAssignmentModal } from './phase-assignment-modal'
import { sendPhaseEmail } from '@/lib/utils/phase-email'
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
    } else if (phase.status === 'IN_PROGRESS' || phase.status === 'COMPLETE') {
      // Navigate to stage workspace (for both active and completed phases)
      if (phase.stageId) {
        // For FFE phases, go directly to the FFE workspace
        if (phase.id === 'FFE') {
          router.push(`/ffe/${roomId}/workspace`)
        } else {
          router.push(`/stages/${phase.stageId}`)
        }
      }
    }
  }

  const handleStatusChange = async (phaseId: PhaseId, newStatus: PhaseStatus) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase?.stageId) return
    
    // Special handling for completion - check if there's a next assignee to email
    if (newStatus === 'COMPLETE') {
      console.log('=== COMPLETION HANDLER START ===')
      console.log('Handling completion for phase:', phase.id)
      console.log('Phase object:', phase)
      console.log('All phases in room:', phases)
      
      // Let's try a simpler approach - just look for any assigned phases after this one
      // Note: RENDERING is the same as THREE_D in some contexts
      const phaseSequence = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
      let currentIndex = -1
      
      // Handle RENDERING as THREE_D for compatibility
      if (phase.id === 'RENDERING' || phase.id === 'THREE_D') {
        currentIndex = phaseSequence.indexOf('THREE_D')
      } else {
        currentIndex = phaseSequence.indexOf(phase.id as any)
      }
      console.log('Current phase index:', currentIndex, 'out of', phaseSequence.length)
      
      let nextAssignee = null
      let nextPhaseName = null
      
      // Look for the next assigned phase
      for (let i = currentIndex + 1; i < phaseSequence.length; i++) {
        const nextPhaseId = phaseSequence[i]
        const nextPhase = phases.find(p => p.id === nextPhaseId)
        console.log('Checking next phase:', nextPhaseId, 'found:', !!nextPhase, 'assignee:', nextPhase?.assignedUser?.name)
        console.log('Full next phase object:', nextPhase)
        
        if (nextPhase?.assignedUser) {
          nextAssignee = nextPhase.assignedUser
          nextPhaseName = nextPhaseId
          console.log('Found next assignee:', nextAssignee.name, 'for phase:', nextPhaseName)
          break
        }
      }
      
      // Also let's see all phases and their IDs
      console.log('All phases with their IDs and assignees:')
      phases.forEach((p, index) => {
        console.log(`  ${index}: ID='${p.id}', assignee='${p.assignedUser?.name || 'none'}'`)
      })
      
      console.log('Final next assignee found:', nextAssignee?.name)
      console.log('=== COMPLETION HANDLER END ===')
      
      if (nextAssignee) {
        // Show simple email confirmation
        const phaseNames: Record<string, string> = {
          'DESIGN_CONCEPT': 'Design Concept',
          'THREE_D': '3D Rendering',
          'RENDERING': '3D Rendering',
          'CLIENT_APPROVAL': 'Client Approval',
          'DRAWINGS': 'Drawings',
          'FFE': 'FFE'
        }
        const currentPhaseName = phaseNames[phase.id] || phase.id
        const shouldSendEmail = window.confirm(
          `Send email to ${nextAssignee.name} about the completed ${currentPhaseName} phase?`
        )
        
        console.log('User chose to send email:', shouldSendEmail)
        
        // Complete the phase
        await executePhaseCompletion(phase, shouldSendEmail, [{stageId: phases.find(p => p.assignedUser?.id === nextAssignee.id)?.stageId, stageType: nextPhaseName, assignee: nextAssignee}])
      } else {
        // No next assignee, just complete normally
        console.log('No next assignee found, completing normally')
        await executeStatusChange(phase, newStatus)
      }
      return
    }
    
    // Handle non-completion status changes normally
    await executeStatusChange(phase, newStatus)
  }
  
  const executePhaseCompletion = async (phase: Phase, sendEmail: boolean, nextPhaseInfo: any[]) => {
    setLoading(phase.id)
    try {
      // Complete the phase first
      console.log('Completing phase:', phase.id, 'stageId:', phase.stageId)
      
      const response = await fetch(`/api/stages/${phase.stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to complete phase'
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const responseText = await response.text()
          console.log('Error response text:', responseText)
          
          if (responseText) {
            try {
              const errorData = JSON.parse(responseText)
              console.error('API Error:', errorData)
              errorMessage = errorData.error || errorMessage
              errorDetails = errorData.details || errorDetails
            } catch (parseError) {
              console.error('Response is not valid JSON:', parseError)
              errorDetails = responseText || errorDetails
            }
          }
        } catch (textError) {
          console.error('Failed to read error response:', textError)
        }
        
        throw new Error(errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage)
      }
      
      console.log('Phase completed successfully')
      
      // Send emails if requested and there are assignees
      if (sendEmail && nextPhaseInfo.length > 0) {
        const emailPromises = nextPhaseInfo
          .filter(info => info.assignee)
          .map(async (info) => {
            try {
              console.log(`Sending email for ${info.stageType} to ${info.assignee?.name}`)
              const emailResult = await sendPhaseEmail(info.stageId)
              if (!emailResult.success) {
                console.error(`Failed to send email for ${info.stageType}:`, emailResult.error)
              } else {
                console.log(`Email sent successfully for ${info.stageType}`)
              }
              return emailResult
            } catch (error) {
              console.error(`Error sending email for ${info.stageType}:`, error)
              return { success: false, error: 'Network error' }
            }
          })
        
        const emailResults = await Promise.all(emailPromises)
        const successCount = emailResults.filter(r => r.success).length
        const failureCount = emailResults.filter(r => !r.success).length
        
        if (failureCount > 0 && successCount > 0) {
          alert(`Phase completed! ${successCount} email(s) sent successfully, ${failureCount} failed.`)
        } else if (successCount > 0) {
          alert(`Phase completed! Email sent successfully to the next team member.`)
        } else if (failureCount > 0) {
          alert(`Phase completed! Failed to send email to the next team member.`)
        }
      } else {
        alert('Phase completed successfully!')
      }
      
      // Refresh the page to show updated status
      window.location.reload()
      
    } catch (error) {
      console.error('Error completing phase:', error)
      alert(`Failed to complete phase: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
    }
  }
  
  const getNextPhaseInfo = (currentPhaseId: PhaseId) => {
    // Define phase sequence
    const phaseSequence: PhaseId[] = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const currentIndex = phaseSequence.indexOf(currentPhaseId)
    
    console.log('Getting next phase info for:', currentPhaseId)
    console.log('Current index:', currentIndex)
    console.log('Available phases:', phases.map(p => ({ id: p.id, assignedUser: p.assignedUser?.name })))
    
    const nextPhases = []
    
    if (currentPhaseId === 'CLIENT_APPROVAL') {
      // Special case: Client approval enables both DRAWINGS and FFE
      const drawingsPhase = phases.find(p => p.id === 'DRAWINGS')
      const ffePhase = phases.find(p => p.id === 'FFE')
      
      console.log('Client approval case - drawings:', drawingsPhase?.assignedUser?.name, 'ffe:', ffePhase?.assignedUser?.name)
      
      if (drawingsPhase?.assignedUser) {
        nextPhases.push({
          stageId: drawingsPhase.stageId,
          stageType: 'DRAWINGS',
          assignee: drawingsPhase.assignedUser
        })
      }
      
      if (ffePhase?.assignedUser) {
        nextPhases.push({
          stageId: ffePhase.stageId,
          stageType: 'FFE', 
          assignee: ffePhase.assignedUser
        })
      }
    } else if (currentIndex !== -1 && currentIndex < phaseSequence.length - 1) {
      // Regular sequence: find next phase
      const nextPhaseId = phaseSequence[currentIndex + 1]
      const nextPhase = phases.find(p => p.id === nextPhaseId)
      
      console.log('Regular sequence - next phase:', nextPhaseId, 'found:', nextPhase?.assignedUser?.name)
      
      if (nextPhase?.assignedUser) {
        nextPhases.push({
          stageId: nextPhase.stageId,
          stageType: nextPhaseId,
          assignee: nextPhase.assignedUser
        })
      }
    }
    
    console.log('Next phases found:', nextPhases)
    return nextPhases
  }
  
  const executeStatusChange = async (phase: Phase, newStatus: PhaseStatus) => {
    setLoading(phase.id)
    try {
      const action = newStatus === 'COMPLETE' ? 'complete' : 
                    newStatus === 'IN_PROGRESS' ? 'start' : 
                    newStatus === 'NOT_APPLICABLE' ? 'mark_not_applicable' :
                    newStatus === 'PENDING' ? 'mark_applicable' : 'reopen'
      
      console.log('Updating phase status:', {
        phaseId: phase.id,
        stageId: phase.stageId,
        action,
        newStatus
      })
      
      const response = await fetch(`/api/stages/${phase.stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        let errorMessage = 'Failed to update phase status'
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const responseText = await response.text()
          console.log('Raw response text:', responseText)
          
          if (responseText && responseText.trim()) {
            try {
              const errorData = JSON.parse(responseText)
              console.error('API Error:', errorData)
              if (errorData && typeof errorData === 'object') {
                errorMessage = errorData.error || errorMessage
                errorDetails = errorData.details || errorDetails
              }
            } catch (parseError) {
              console.error('Response is not valid JSON:', parseError)
              errorDetails = responseText || errorDetails
            }
          } else {
            console.error('Empty response body')
          }
        } catch (textError) {
          console.error('Failed to read error response:', textError)
        }
        
        throw new Error(`${errorMessage} - ${errorDetails}`)
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
