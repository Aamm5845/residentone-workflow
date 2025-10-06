'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, CheckCircle, Phone, Mail, MessageCircle, User, AlertCircle } from 'lucide-react'

interface ClientApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (method: string, notes?: string) => Promise<void>
  loading: boolean
  versionNumber: string
}

export default function ClientApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  versionNumber
}: ClientApprovalModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const approvalMethods = [
    {
      id: 'email',
      icon: Mail,
      label: 'Via Email',
      description: 'Client approved through email response'
    },
    {
      id: 'phone',
      icon: Phone,
      label: 'Via Phone',
      description: 'Client approved during phone conversation'
    },
    {
      id: 'meeting',
      icon: User,
      label: 'In-Person Meeting',
      description: 'Client approved during face-to-face meeting'
    },
    {
      id: 'text',
      icon: MessageCircle,
      label: 'Via Text/SMS',
      description: 'Client approved through text message'
    }
  ]

  const handleConfirm = async () => {
    if (!selectedMethod) {
      setError('Please select how the client approved the floorplan.')
      return
    }

    setError('')
    try {
      await onConfirm(selectedMethod, notes.trim() || undefined)
      setNotes('')
      setSelectedMethod(null)
      onClose()
    } catch (error) {
      console.error('Error recording client approval:', error)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setNotes('')
      setSelectedMethod(null)
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Client Approved {versionNumber}
              </h3>
              <p className="text-sm text-gray-600">
                How did the client approve this floorplan?
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={loading}
            className="ml-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Approval Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {approvalMethods.map((method) => {
                const IconComponent = method.icon
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method.id)
                      if (error) setError('') // Clear error when selection is made
                    }}
                    disabled={loading}
                    className={`p-3 border-2 rounded-lg text-left transition-all duration-200 ${
                      selectedMethod === method.id
                        ? 'border-green-500 bg-green-50 text-green-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <IconComponent className={`w-4 h-4 ${
                        selectedMethod === method.id ? 'text-green-600' : 'text-gray-500'
                      }`} />
                      <span className="text-sm font-medium">{method.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="approval-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details about the approval process, client feedback, or next steps..."
              className="min-h-[80px] resize-none"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-xs text-green-700">
              <strong>Note:</strong> This will mark the floorplan as client-approved and create an activity log entry 
              with the selected approval method for future reference.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedMethod}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Recording...' : 'Record Approval'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}