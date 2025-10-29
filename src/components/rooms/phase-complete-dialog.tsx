'use client'

import { Mail, User, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog'
import { getPhaseConfig } from '@/lib/constants/room-phases'

interface NextPhaseInfo {
  stageId: string
  stageType: string
  assignee: {
    id: string
    name: string
    email: string
  } | null
}

interface Phase {
  id: string
  status: string
  assignedUser?: {
    id: string
    name: string
    email: string
  } | null
}

interface PhaseCompleteDialogProps {
  open: boolean
  currentPhase: Phase
  nextPhaseInfo?: NextPhaseInfo[]
  onCancel: () => void
  onComplete: (sendEmail: boolean) => void
  loading?: boolean
}

export default function PhaseCompleteDialog({
  open,
  currentPhase,
  nextPhaseInfo,
  onCancel,
  onComplete,
  loading = false
}: PhaseCompleteDialogProps) {
  // Get current phase config for display
  const currentPhaseConfig = getPhaseConfig(currentPhase.id as any)
  
  // Get the next assignee (just the first one for simplicity)
  const nextAssignee = nextPhaseInfo?.find(info => info.assignee)?.assignee
  const nextPhaseName = nextPhaseInfo?.find(info => info.assignee)?.stageType
  
  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Complete Phase</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            You're about to mark the <strong>{currentPhaseConfig?.label || currentPhase.id}</strong> phase as complete.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {nextAssignee && nextPhaseName ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Send email to next team member?
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>{nextAssignee.name}</strong> is assigned to the next phase and will be notified that they can begin working.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                {nextPhaseInfo && nextPhaseInfo.length > 0 
                  ? "The next phase is not yet assigned to anyone."
                  : "This is the final phase for this room."
                }
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex space-x-2 w-full">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            
            {nextAssignee ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onComplete(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Completing...' : 'Complete Only'}
                </Button>
                <Button
                  onClick={() => onComplete(true)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  {loading ? 'Completing...' : 'Complete & Email'}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => onComplete(false)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white flex-1"
              >
                {loading ? 'Completing...' : 'Complete Phase'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
