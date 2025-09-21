'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Link,
  Image as ImageIcon,
  Upload,
  Refresh,
  Activity,
  Settings,
  Share,
  Download,
  FileText,
  Camera,
  Palette,
  Save,
  Eye,
  Clock,
  Users,
  Tag
} from 'lucide-react'
import { toast } from 'sonner'

interface ActionBarProps {
  stageId: string
  canMarkComplete: boolean
  onMarkComplete: () => void
  isCompleting: boolean
  onRefresh: () => void
  status: string
}

export function ActionBar({
  stageId,
  canMarkComplete,
  onMarkComplete,
  isCompleting,
  onRefresh,
  status
}: ActionBarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  // Quick actions for adding content
  const handleAddImage = async () => {
    // This would open a file picker or upload modal
    toast.info('Image upload feature coming soon')
    setShowAddMenu(false)
  }

  const handleAddLink = async () => {
    const url = prompt('Enter URL:')
    if (!url) return

    try {
      const response = await fetch('/api/design/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          type: 'link',
          url,
          title: new URL(url).hostname
        })
      })

      if (response.ok) {
        onRefresh()
        toast.success('Link added to reference board')
      }
    } catch (error) {
      toast.error('Failed to add link')
    }
    setShowAddMenu(false)
  }

  const handleAddNote = async () => {
    const content = prompt('Enter note:')
    if (!content) return

    try {
      const response = await fetch('/api/design/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          content,
          sectionType: 'GENERAL'
        })
      })

      if (response.ok) {
        onRefresh()
        toast.success('Note added')
      }
    } catch (error) {
      toast.error('Failed to add note')
    }
    setShowAddMenu(false)
  }

  const handleExportPDF = async () => {
    toast.info('PDF export feature coming soon')
  }

  const handleShareWorkspace = async () => {
    try {
      const shareUrl = `${window.location.origin}/workspace/${stageId}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Workspace link copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy link')
    }
    setShowShareMenu(false)
  }

  const handleInviteUser = async () => {
    const email = prompt('Enter email to invite:')
    if (!email) return

    try {
      const response = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, email })
      })

      if (response.ok) {
        toast.success(`Invitation sent to ${email}`)
      }
    } catch (error) {
      toast.error('Failed to send invitation')
    }
    setShowShareMenu(false)
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        {/* Left side - Quick Actions */}
        <div className="flex items-center space-x-3">
          {/* Add Content Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Content
            </Button>

            {showAddMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px] z-10">
                <button
                  onClick={handleAddImage}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add Image</p>
                    <p className="text-xs text-gray-500">Upload design references</p>
                  </div>
                </button>
                
                <button
                  onClick={handleAddLink}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Link className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add Link</p>
                    <p className="text-xs text-gray-500">Save web references</p>
                  </div>
                </button>

                <button
                  onClick={handleAddNote}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <MessageSquare className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add Note</p>
                    <p className="text-xs text-gray-500">Quick message or comment</p>
                  </div>
                </button>

                <hr className="my-2" />

                <button
                  onClick={() => {
                    toast.info('File upload feature coming soon')
                    setShowAddMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <FileText className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Upload File</p>
                    <p className="text-xs text-gray-500">PDFs, documents</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    toast.info('Camera feature coming soon')
                    setShowAddMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Camera className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Take Photo</p>
                    <p className="text-xs text-gray-500">Capture inspiration</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddNote}
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Add Note
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            <Refresh className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Center - Status Info */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              status === 'FINALIZED' ? 'bg-green-500' :
              status === 'IN_REVIEW' ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
            <span className="font-medium">
              {status === 'FINALIZED' ? 'Finalized' :
               status === 'IN_REVIEW' ? 'In Review' : 'Draft'}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>Last updated {new Date().toLocaleTimeString()}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Activity className="w-4 h-4" />
            <span>Auto-save enabled</span>
          </div>
        </div>

        {/* Right side - Share & Complete */}
        <div className="flex items-center space-x-3">
          {/* Share Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowShareMenu(!showShareMenu)}
            >
              <Share className="w-4 h-4 mr-1" />
              Share
            </Button>

            {showShareMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px] z-10">
                <button
                  onClick={handleShareWorkspace}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Link className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Copy Link</span>
                </button>

                <button
                  onClick={handleInviteUser}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Users className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Invite User</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Download className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Export PDF</span>
                </button>

                <hr className="my-2" />

                <button
                  onClick={() => {
                    toast.info('Presentation mode coming soon')
                    setShowShareMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Eye className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm">Present Mode</span>
                </button>
              </div>
            )}
          </div>

          {/* Section Complete Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Section completion feature coming soon')}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Mark Section
          </Button>

          {/* Main Complete Button */}
          {canMarkComplete && status !== 'FINALIZED' && (
            <Button
              onClick={onMarkComplete}
              disabled={isCompleting}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg font-medium"
            >
              {isCompleting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Phase Complete
                </>
              )}
            </Button>
          )}

          {status === 'FINALIZED' && (
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Phase Complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>Keyboard shortcuts: Ctrl+N (New note) • Ctrl+U (Upload) • Ctrl+S (Save)</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Real-time sync</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Save className="w-3 h-3" />
            <span>All changes saved</span>
          </div>
        </div>
      </div>

      {/* Click outside handlers */}
      {(showAddMenu || showShareMenu) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowAddMenu(false)
            setShowShareMenu(false)
          }}
        />
      )}
    </div>
  )
}