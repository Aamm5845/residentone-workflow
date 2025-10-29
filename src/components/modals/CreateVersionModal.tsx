'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, FileText, AlertCircle } from 'lucide-react'

interface CreateVersionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (notes: string) => Promise<void>
  loading: boolean
  versionNumber: string
}

export default function CreateVersionModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  versionNumber
}: CreateVersionModalProps) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!notes.trim()) {
      setError('Version notes are required. Please describe what\'s new or changed in this version.')
      return
    }

    if (notes.trim().length < 5) {
      setError('Please provide a brief description (at least 5 characters).')
      return
    }

    setError('')
    try {
      await onConfirm(notes.trim())
      setNotes('')
      onClose()
    } catch (error) {
      console.error('Error creating version:', error)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setNotes('')
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
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Create Version {versionNumber}
              </h3>
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
          <div className="mb-4">
            <label htmlFor="version-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Version Notes <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="version-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                if (error) setError('') // Clear error when user starts typing
              }}
              placeholder="What changed in this version?"
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
              disabled={loading || !notes.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : `Create ${versionNumber}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
