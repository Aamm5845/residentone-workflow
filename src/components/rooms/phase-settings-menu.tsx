'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Settings, 
  Minus, 
  RotateCcw
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
  const [loading, setLoading] = useState(false)

  const isNotApplicable = currentStatus === 'NOT_APPLICABLE'
  const canMarkNotApplicable = currentStatus === 'PENDING' || currentStatus === 'COMPLETE' || currentStatus === 'IN_PROGRESS'
  const canMarkApplicable = currentStatus === 'NOT_APPLICABLE'

  const handleMarkNotApplicable = async () => {
    setLoading(true)
    try {
      onStatusChange('NOT_APPLICABLE')
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
                  onClick={handleMarkNotApplicable}
                  disabled={loading}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                >
                  <Minus className="w-4 h-4 mr-3" />
                  {loading ? 'Marking...' : 'Mark as Not Applicable'}
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

    </div>
  )
}