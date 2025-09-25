'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Settings, 
  Minus, 
  RotateCcw,
  AlertTriangle,
  X 
} from 'lucide-react'
import { type PhaseStatus } from '@/lib/constants/room-phases'

interface PhaseSettingsMenuProps {
  phaseId: string
  phaseName: string
  currentStatus: PhaseStatus
  onStatusChange: (status: PhaseStatus) => void
  disabled?: boolean
}

export default function PhaseSettingsMenu({
  phaseId,
  phaseName,
  currentStatus,
  onStatusChange,
  disabled = false
}: PhaseSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showNotApplicableConfirm, setShowNotApplicableConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const isNotApplicable = currentStatus === 'NOT_APPLICABLE'
  const canMarkNotApplicable = currentStatus === 'PENDING' || currentStatus === 'COMPLETE'
  const canMarkApplicable = currentStatus === 'NOT_APPLICABLE'

  const handleMarkNotApplicable = async () => {
    setLoading(true)
    try {
      onStatusChange('NOT_APPLICABLE')
      setShowNotApplicableConfirm(false)
      setIsOpen(false)
    } catch (error) {
      console.error('Error marking as not applicable:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkApplicable = async () => {
    setLoading(true)
    try {
      onStatusChange('PENDING')
      setIsOpen(false)
    } catch (error) {
      console.error('Error marking as applicable:', error)
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
        disabled={disabled}
        className={`p-1 h-7 w-7 text-gray-400 hover:text-gray-600 rounded-md ${
          isNotApplicable ? 'text-gray-300' : ''
        }`}
      >
        <Settings className="h-3 w-3" />
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
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100 mb-2">
                {phaseName} Settings
              </div>
              
              {/* Not Applicable Options */}
              {canMarkNotApplicable && (
                <button
                  onClick={() => setShowNotApplicableConfirm(true)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Minus className="w-4 h-4 mr-3" />
                  Mark as Not Applicable
                </button>
              )}
              
              {canMarkApplicable && (
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

      {/* Not Applicable Confirmation Modal */}
      {showNotApplicableConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <Minus className="w-6 h-6 text-gray-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Mark as Not Applicable</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Mark the <strong>{phaseName}</strong> phase as not applicable? 
              This will hide the phase from the active workflow and skip it during project execution.
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
    </div>
  )
}