'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Settings, 
  RotateCcw, 
  Minus, 
  AlertTriangle,
  X,
  Share2
} from 'lucide-react'
import AccessTokenManagement from '@/components/shared/AccessTokenManagement'

interface PhaseSettingsMenuProps {
  stageId: string
  stageName: string
  isNotApplicable?: boolean
  onReset?: () => void
  onMarkNotApplicable?: () => void
  onMarkApplicable?: () => void
}

export default function PhaseSettingsMenu({
  stageId,
  stageName,
  isNotApplicable = false,
  onReset,
  onMarkNotApplicable,
  onMarkApplicable
}: PhaseSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showNotApplicableConfirm, setShowNotApplicableConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stages/${stageId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to reset phase')
      }

      if (onReset) onReset()
      setShowResetConfirm(false)
      setIsOpen(false)
      window.location.reload() // Force refresh to show changes
    } catch (error) {
      console.error('Error resetting phase:', error)
      alert('Failed to reset phase. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkNotApplicable = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_not_applicable'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark as not applicable')
      }

      if (onMarkNotApplicable) onMarkNotApplicable()
      setShowNotApplicableConfirm(false)
      setIsOpen(false)
      window.location.reload() // Force refresh to show changes
    } catch (error) {
      console.error('Error marking as not applicable:', error)
      alert('Failed to mark phase as not applicable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkApplicable = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_applicable'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark as applicable')
      }

      if (onMarkApplicable) onMarkApplicable()
      setIsOpen(false)
      window.location.reload() // Force refresh to show changes
    } catch (error) {
      console.error('Error marking as applicable:', error)
      alert('Failed to mark phase as applicable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Settings Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 h-8 w-8 ${isNotApplicable ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Settings className="w-4 h-4" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100 mb-2">
                {stageName} Settings
              </div>
              
              {/* Share Option */}
              <button
                onClick={() => {
                  setShowShareModal(true)
                  setIsOpen(false)
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Share2 className="w-4 h-4 mr-3" />
                Share Phase
              </button>
              
              {/* Reset Option */}
              {!isNotApplicable && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-3" />
                  Reset Phase
                </button>
              )}
              
              {/* Not Applicable Options */}
              {!isNotApplicable ? (
                <button
                  onClick={() => setShowNotApplicableConfirm(true)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Minus className="w-4 h-4 mr-3" />
                  Mark as Not Applicable
                </button>
              ) : (
                <button
                  onClick={handleMarkApplicable}
                  disabled={loading}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 mr-3" />
                  {loading ? 'Restoring...' : 'Mark as Applicable'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Reset Phase</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to reset the <strong>{stageName}</strong> phase? 
              This will permanently delete all data, progress, and files associated with this phase.
            </p>
            
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowResetConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReset}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? 'Resetting...' : 'Reset Phase'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Not Applicable Confirmation Modal */}
      {showNotApplicableConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <Minus className="w-6 h-6 text-gray-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Mark as Not Applicable</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Mark the <strong>{stageName}</strong> phase as not applicable? 
              This will hide the phase from the workflow and prevent any work from being done on it.
            </p>
            
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowNotApplicableConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkNotApplicable}
                disabled={loading}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                {loading ? 'Marking...' : 'Mark as N/A'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Share {stageName} Phase</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6">
              <AccessTokenManagement
                entityType="phase"
                entityId={stageId}
                entityName={stageName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
