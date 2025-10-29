'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Briefcase, 
  ArrowLeft,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import FFESettingsDepartment from './FFESettingsDepartment'
import FFEPhaseWorkspace from './v2/FFEPhaseWorkspace'

export type FFEDepartmentMode = 'settings' | 'workspace'

interface FFEDepartmentRouterProps {
  roomId: string
  roomName: string
  orgId?: string
  projectId?: string
  projectName?: string
  initialMode?: FFEDepartmentMode
  userRole?: string
  disabled?: boolean
  onModeChange?: (mode: FFEDepartmentMode) => void
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
  showModeToggle?: boolean
}

export default function FFEDepartmentRouter({
  roomId,
  roomName,
  orgId,
  projectId,
  projectName,
  initialMode = 'workspace',
  userRole,
  disabled = false,
  onModeChange,
  onProgressUpdate,
  showModeToggle = true
}: FFEDepartmentRouterProps) {
  const [currentMode, setCurrentMode] = useState<FFEDepartmentMode>(initialMode)
  const [workspaceProgress, setWorkspaceProgress] = useState(0)
  const [workspaceComplete, setWorkspaceComplete] = useState(false)

  // Allow all users to access settings
  const canAccessSettings = true
  
  const handleModeChange = (mode: FFEDepartmentMode) => {
    setCurrentMode(mode)
    onModeChange?.(mode)
  }

  const handleWorkspaceProgressUpdate = (progress: number, isComplete: boolean) => {
    setWorkspaceProgress(progress)
    setWorkspaceComplete(isComplete)
    onProgressUpdate?.(progress, isComplete)
  }

  const getModeConfig = (mode: FFEDepartmentMode) => {
    switch (mode) {
      case 'settings':
        return {
          icon: Settings,
          label: 'Settings',
          description: 'Manage sections, items, templates, and visibility',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        }
      case 'workspace':
        return {
          icon: Briefcase,
          label: 'Workspace',
          description: 'Execute FFE tasks and track progress',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        }
    }
  }

  const currentConfig = getModeConfig(currentMode)
  const CurrentIcon = currentConfig.icon

  return (
    <div className="space-y-6">
      {/* Mode Toggle Header - Only show if showModeToggle is true */}
      {showModeToggle ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center">
                  <CurrentIcon className={cn("w-6 h-6 mr-3", currentConfig.color)} />
                  FFE {currentConfig.label} - {roomName}
                </h1>
                <p className="text-gray-600 mt-1">{currentConfig.description}</p>
              </div>

              <div className="flex items-center space-x-3">
                {/* Progress indicator for workspace mode */}
                {currentMode === 'workspace' && (
                  <div className="text-right">
                    <div className={cn(
                      "text-lg font-bold",
                      workspaceComplete ? "text-green-600" : "text-blue-600"
                    )}>
                      {Math.round(workspaceProgress)}%
                    </div>
                    <div className="text-xs text-gray-600">Complete</div>
                  </div>
                )}

                {/* Mode toggle buttons */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={currentMode === 'workspace' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleModeChange('workspace')}
                    disabled={disabled}
                    className={cn(
                      "px-3 py-2",
                      currentMode === 'workspace' && "bg-white shadow-sm"
                    )}
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    Workspace
                  </Button>
                  
                  {canAccessSettings && (
                    <Button
                      variant={currentMode === 'settings' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleModeChange('settings')}
                      disabled={disabled}
                      className={cn(
                        "px-3 py-2",
                        currentMode === 'settings' && "bg-white shadow-sm"
                      )}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Mode-specific info banner */}
            <div className={cn(
              "mt-4 p-3 rounded-lg border-l-4",
              currentConfig.bgColor,
              currentConfig.borderColor
            )}>
              <div className="flex items-start space-x-2">
                <Info className={cn("w-4 h-4 mt-0.5 flex-shrink-0", currentConfig.color)} />
                <div className="text-sm">
                  {currentMode === 'settings' ? (
                    <div>
                      <strong>Settings Department:</strong> Add sections and items, import templates, 
                      and use the "Use"/"Remove" buttons to control which items appear in the workspace. 
                      Items are never deleted, only hidden from the workspace view.
                    </div>
                  ) : (
                    <div>
                      <strong>Workspace Department:</strong> Work with only the items marked as visible 
                      in Settings. Track progress by moving items from Pending → Undecided → Completed. 
                      Add notes that persist across status changes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Render the appropriate department component */}
      <div>
        {currentMode === 'settings' ? (
          <FFESettingsDepartment
            roomId={roomId}
            roomName={roomName}
            orgId={orgId}
            projectId={projectId}
            projectName={projectName}
            disabled={disabled}
          />
        ) : (
          <FFEPhaseWorkspace
            roomId={roomId}
            roomType="" 
            orgId={orgId || ''}
            projectId={projectId || ''}
            onProgressUpdate={handleWorkspaceProgressUpdate}
            roomName={roomName}
            projectName={projectName}
          />
        )}
      </div>

    </div>
  )
}
