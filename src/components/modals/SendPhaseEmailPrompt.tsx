'use client'

import { useState } from 'react'
import { X, Mail, UserCheck, Clock, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NextPhaseInfo {
  stageId: string
  stageType: string
  assignee: {
    id: string
    name: string
    email: string
  } | null
  emailPreview?: {
    subject: string
    preview: string
  }
}

interface SendPhaseEmailPromptProps {
  isOpen: boolean
  onClose: () => void
  nextPhaseInfo: NextPhaseInfo[]
  completedPhase: string
  projectName: string
  roomName: string
  onSendEmails: (stageIds: string[]) => Promise<void>
  onSkip: () => void
}

export default function SendPhaseEmailPrompt({
  isOpen,
  onClose,
  nextPhaseInfo,
  completedPhase,
  projectName,
  roomName,
  onSendEmails,
  onSkip
}: SendPhaseEmailPromptProps) {
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(
    nextPhaseInfo.map(info => info.stageId)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [emailsSent, setEmailsSent] = useState<string[]>([])

  if (!isOpen || nextPhaseInfo.length === 0) {
    return null
  }

  const handleSendEmails = async () => {
    if (selectedStageIds.length === 0) {
      onSkip()
      return
    }

    setIsLoading(true)
    try {
      await onSendEmails(selectedStageIds)
      setEmailsSent(selectedStageIds)
      
      // Show success for a moment, then close
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Error sending emails:', error)
      setIsLoading(false)
    }
  }

  const handleToggleStage = (stageId: string) => {
    setSelectedStageIds(prev => 
      prev.includes(stageId) 
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    )
  }

  const getPhaseDisplayName = (phaseType: string) => {
    const phaseNames: Record<string, string> = {
      'DESIGN_CONCEPT': 'Design Concept',
      'THREE_D': '3D Rendering',
      'CLIENT_APPROVAL': 'Client Approval',
      'DRAWINGS': 'Drawings',
      'FFE': 'FFE'
    }
    return phaseNames[phaseType] || phaseType
  }

  const getPhaseColor = (phaseType: string) => {
    const colors: Record<string, string> = {
      'DESIGN_CONCEPT': 'bg-purple-100 text-purple-800 border-purple-200',
      'THREE_D': 'bg-orange-100 text-orange-800 border-orange-200',
      'CLIENT_APPROVAL': 'bg-blue-100 text-blue-800 border-blue-200',
      'DRAWINGS': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'FFE': 'bg-pink-100 text-pink-800 border-pink-200'
    }
    return colors[phaseType] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {getPhaseDisplayName(completedPhase)} Complete! 🎉
                </h2>
                <p className="text-sm text-gray-600">
                  {roomName} • {projectName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {emailsSent.length > 0 ? (
            // Success State
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Emails Sent Successfully!
              </h3>
              <p className="text-gray-600">
                {emailsSent.length} notification{emailsSent.length !== 1 ? 's' : ''} sent to team members.
              </p>
            </div>
          ) : (
            <>
              {/* Introduction */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Notify Next Team Members?
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  The {getPhaseDisplayName(completedPhase)} phase is now complete. 
                  Would you like to send email notifications to the team members 
                  assigned to the next phase{nextPhaseInfo.length > 1 ? 's' : ''}?
                </p>
              </div>

              {/* Next Phase List */}
              <div className="space-y-4 mb-6">
                {nextPhaseInfo.map((phaseInfo) => (
                  <div key={phaseInfo.stageId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          id={`stage-${phaseInfo.stageId}`}
                          checked={selectedStageIds.includes(phaseInfo.stageId)}
                          onChange={() => handleToggleStage(phaseInfo.stageId)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={isLoading}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={`stage-${phaseInfo.stageId}`}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`text-xs px-2 py-1 rounded-md font-medium border ${getPhaseColor(phaseInfo.stageType)}`}>
                                {getPhaseDisplayName(phaseInfo.stageType)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                              {phaseInfo.assignee ? (
                                <div className="flex items-center space-x-1">
                                  <UserCheck className="w-3 h-3 text-green-600" />
                                  <span className="text-sm font-medium text-gray-900">
                                    {phaseInfo.assignee.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({phaseInfo.assignee.email})
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  <span className="text-sm text-amber-600">
                                    No assignee
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {phaseInfo.emailPreview && (
                              <div className="ml-5 text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                                <div className="font-medium mb-1">
                                  📧 {phaseInfo.emailPreview.subject}
                                </div>
                                <div className="text-gray-400">
                                  {phaseInfo.emailPreview.preview}
                                </div>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={onSkip}
                  disabled={isLoading}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                >
                  Skip notifications
                </button>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={handleSendEmails}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>
                          Send {selectedStageIds.length} Email{selectedStageIds.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}