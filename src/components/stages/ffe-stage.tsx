'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Settings, AlertTriangle, Plus, Package, Info, StickyNote } from 'lucide-react'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from './PhaseSettingsMenu'
import FFEDepartmentRouter from '../ffe/FFEDepartmentRouter'
import Link from 'next/link'
// New FFE system - template-based, user-managed

export default function FFEStage({ 
  stage, 
  room, 
  project, 
  onComplete 
}: any) {
  const { data: session } = useSession()
  const [ffeProgress, setFFEProgress] = useState(0)
  const [isFFEComplete, setIsFFEComplete] = useState(false)
  
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
              <Link href={`/ffe/${room.id}/settings`}>
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
            <Button asChild variant="outline" size="sm">
              <Link href={`/ffe/${room.id}/settings`}>
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
          
        </div>
      </div>
      
      {/* Main Content - Direct Link to FFE Workspace */}
      <div className="flex">
        {/* FFE Navigation */}
        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <div className="mb-6">
              <Package className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">FFE Management</h3>
              <p className="text-gray-600 mb-6">
                Use the workspace to track FFE progress and the settings to configure items.
              </p>
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button asChild size="lg">
                <Link href={`/ffe/${room.id}/workspace`}>
                  <Package className="h-5 w-5 mr-2" />
                  Open Workspace
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={`/ffe/${room.id}/settings`}>
                  <Settings className="h-5 w-5 mr-2" />
                  FFE Settings
                </Link>
              </Button>
            </div>
          </div>
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
