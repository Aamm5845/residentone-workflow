'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, CheckCircle, AlertCircle, Send, X } from 'lucide-react'

interface Recipient {
  id: string
  name: string
  email: string
  role?: string
  alreadySent: boolean
}

interface NextPhase {
  id: string
  name: string
  type: string
}

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  stageId: string
  onSuccess?: (result: any) => void
}

interface NotificationData {
  recipients: Recipient[]
  nextPhases: NextPhase[]
  actorIncluded: boolean
}

export default function TeamNotificationModal({
  isOpen,
  onClose,
  stageId,
  onSuccess
}: NotificationModalProps) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [notificationData, setNotificationData] = useState<NotificationData | null>(null)
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())
  const [customMessage, setCustomMessage] = useState('')
  const [includeActor, setIncludeActor] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch notification data when modal opens
  useEffect(() => {
    if (isOpen && stageId) {
      fetchNotificationData()
    }
  }, [isOpen, stageId])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNotificationData(null)
      setSelectedRecipients(new Set())
      setCustomMessage('')
      setIncludeActor(false)
      setError(null)
      setLoading(false)
      setSending(false)
    }
  }, [isOpen])

  const fetchNotificationData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/stages/${stageId}/next-assignees`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch notification data')
      }

      const data = await response.json()
      setNotificationData(data)

      // Pre-select recipients who haven't been sent notifications yet
      const eligibleRecipients = data.recipients.filter((r: Recipient) => !r.alreadySent)
      const preSelected = new Set(eligibleRecipients.map((r: Recipient) => r.id))
      setSelectedRecipients(preSelected)

      // Set include actor based on whether they are in the recipient list
      setIncludeActor(false) // Default to false as requested

    } catch (error) {
      console.error('Error fetching notification data:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRecipientToggle = (recipientId: string) => {
    const newSelected = new Set(selectedRecipients)
    if (newSelected.has(recipientId)) {
      newSelected.delete(recipientId)
    } else {
      newSelected.add(recipientId)
    }
    setSelectedRecipients(newSelected)
  }

  const handleSendNotifications = async () => {
    if (selectedRecipients.size === 0) {
      setError('Please select at least one recipient')
      return
    }

    setSending(true)
    setError(null)

    try {
      const response = await fetch(`/api/stages/${stageId}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientIds: Array.from(selectedRecipients),
          customMessage: customMessage.trim() || undefined,
          includeActor
        })
      })

      const result = await response.json()

      if (response.ok || response.status === 207) { // 207 = Multi-status (partial success)
        if (onSuccess) {
          onSuccess(result)
        }
        onClose()
      } else {
        throw new Error(result.error || 'Failed to send notifications')
      }

    } catch (error) {
      console.error('Error sending notifications:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setSending(false)
    }
  }

  const getModalTitle = () => {
    if (!notificationData || notificationData.nextPhases.length === 0) {
      return 'Send Team Notification'
    }
    
    const phaseNames = notificationData.nextPhases.map(p => p.name).join(' & ')
    return `Notify Team: ${phaseNames} Ready`
  }

  const getSelectedCount = () => {
    if (!notificationData) return 0
    return Array.from(selectedRecipients).filter(id => 
      notificationData.recipients.some(r => r.id === id && !r.alreadySent)
    ).length
  }

  const availableRecipients = notificationData?.recipients?.filter(r => !r.alreadySent) || []
  const alreadySentRecipients = notificationData?.recipients?.filter(r => r.alreadySent) || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-600" />
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading recipients...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {notificationData && !loading && (
            <>
              {/* Phase Info */}
              {notificationData.nextPhases.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-900 mb-1">
                    Next Phase{notificationData.nextPhases.length > 1 ? 's' : ''}:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {notificationData.nextPhases.map(phase => (
                      <Badge key={phase.id} variant="secondary" className="bg-green-100 text-green-800">
                        {phase.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipients */}
              {availableRecipients.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">
                    Recipients ({getSelectedCount()} selected)
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableRecipients.map(recipient => (
                      <div key={recipient.id} className="flex items-center space-x-3 p-2 rounded border">
                        <Checkbox
                          checked={selectedRecipients.has(recipient.id)}
                          onCheckedChange={() => handleRecipientToggle(recipient.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {recipient.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {recipient.email}
                          </p>
                        </div>
                        {recipient.role && (
                          <Badge variant="outline" className="text-xs">
                            {recipient.role}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already Sent Recipients */}
              {alreadySentRecipients.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">
                    Already Notified
                  </label>
                  <div className="space-y-1">
                    {alreadySentRecipients.map(recipient => (
                      <div key={recipient.id} className="flex items-center space-x-3 p-2 rounded bg-gray-50 opacity-60">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {recipient.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                          Sent
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Recipients */}
              {availableRecipients.length === 0 && alreadySentRecipients.length === 0 && (
                <div className="text-center py-6">
                  <Mail className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    No assignees found for the next phase{notificationData.nextPhases.length > 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              {/* Custom Message */}
              {availableRecipients.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">
                    Personal Message (Optional)
                  </label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message to include in the notification..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Include Actor Toggle */}
              {notificationData.actorIncluded && availableRecipients.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={includeActor}
                    onCheckedChange={(checked) => setIncludeActor(checked as boolean)}
                  />
                  <label className="text-sm text-gray-700">
                    Include me in the notification
                  </label>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={sending}
            >
              <X className="w-4 h-4 mr-2" />
              Skip
            </Button>
            
            {availableRecipients.length > 0 && (
              <Button
                onClick={handleSendNotifications}
                disabled={sending || selectedRecipients.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send {selectedRecipients.size > 0 ? `to ${selectedRecipients.size}` : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}