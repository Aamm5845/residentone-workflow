'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Settings, AlertTriangle, Plus, Package, Info, StickyNote } from 'lucide-react'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from './PhaseSettingsMenu'
import FFEPhaseWorkspace from '../ffe/v2/FFEPhaseWorkspace'
import { useFFERoomStore } from '@/stores/ffe-room-store'
import Link from 'next/link'
// New FFE system - template-based, user-managed

export default function FFEStage({ 
  stage, 
  room, 
  project, 
  onComplete 
}: any) {
  const { data: session } = useSession()
  const { showNotesDrawer, setShowNotesDrawer, getAllNotes, getCompletionStats, currentInstance } = useFFERoomStore()
  const [ffeProgress, setFFEProgress] = useState(0)
  const [isFFEComplete, setIsFFEComplete] = useState(false)
  const [showUndecidedItems, setShowUndecidedItems] = useState(false)
  
  // Ensure this component only renders for FFE stages
  if (stage.type !== 'FFE') {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Invalid Stage Type</h3>
        </div>
        <p className="text-gray-600">FFE Stage component can only be used for FFE phases.</p>
        <p className="text-sm text-gray-500 mt-1">Current stage type: {stage.type}</p>
      </div>
    )
  }
  
  const isNotApplicable = stage.status === 'NOT_APPLICABLE'
  // No hardcoded room config - all user-managed now
  const roomConfig = null
  
  const handleFFEProgress = (progress: number, isComplete: boolean) => {
    setFFEProgress(progress)
    setIsFFEComplete(isComplete)
  }
  
  const handleComplete = async () => {
    if (!isFFEComplete) {
      const confirm = window.confirm(
        'FFE phase is not fully complete according to room requirements. Are you sure you want to mark it as complete?'
      )
      if (!confirm) return
    }
    
    await onComplete()
  }
  
  if (isNotApplicable) {
    return (
      <div className="border border-gray-300 rounded-xl shadow-lg bg-gray-100 opacity-75">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">FFE Phase Not Applicable</h3>
          <p className="text-gray-600 mb-4">
            This phase has been marked as not applicable for this {room.name || room.type}.
          </p>
          <div className="flex justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href={`/stages/${stage.id}/ffe-settings`}>
                <Settings className="h-4 w-4 mr-2" />
                FFE Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="border border-gray-200 rounded-xl shadow-lg bg-white">
      {/* Stage Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {room.type} FFE Phase
              </h2>
              <p className="text-gray-600 mt-1">{room.name || room.type} • {project.name}</p>
              <p className="text-sm text-emerald-600 mt-1">
                Furniture, Fixtures & Equipment Specification • {ffeProgress}% Complete
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isFFEComplete && (
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full mr-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Ready to Complete</span>
              </div>
            )}
            <Button
              variant={showNotesDrawer ? "default" : "outline"}
              size="sm"
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className="relative"
            >
              <StickyNote className="h-4 w-4 mr-2" />
              Notes
              {getAllNotes().length > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 text-xs">
                  {getAllNotes().length}
                </Badge>
              )}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/stages/${stage.id}/ffe-settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button 
              onClick={handleComplete}
              className={`font-semibold shadow-md hover:shadow-lg px-6 py-3 ${
                isFFEComplete 
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {isFFEComplete ? 'Complete Phase' : 'Force Complete'}
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-1000 ${
                isFFEComplete 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
              style={{ width: `${ffeProgress}%` }}
            />
          </div>
          
          {/* Stats Display */}
          {currentInstance && (() => {
            const stats = getCompletionStats()
            const undecided = stats.total - stats.completed
            
            return (
              <div className="flex gap-6 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <button 
                    onClick={() => setShowUndecidedItems(!showUndecidedItems)}
                    className="text-gray-600 hover:text-gray-900 hover:underline cursor-pointer transition-colors"
                  >
                    {undecided} Undecided
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">{stats.completed} Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">{stats.total} Total</span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
      
      {/* Main Content with Sidebar Layout */}
      <div className="flex">
        {/* Main Workspace */}
        <div className="flex-1 p-6">
          <FFEPhaseWorkspace
            roomId={room.id}
            roomType={room.type}
            orgId={session?.user?.orgId}
            projectId={project.id}
            onProgressUpdate={handleFFEProgress}
            showHeader={false}
            filterUndecided={showUndecidedItems}
          />
        </div>

        {/* Chat Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50">
          <PhaseChat
            stageId={stage.id}
            stageName={`FFE - ${room.name || room.type}`}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
