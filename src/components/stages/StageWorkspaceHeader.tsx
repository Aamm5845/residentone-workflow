'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'
import { WorkspaceTimerButton } from '@/components/timeline/WorkspaceTimerButton'

interface StageWorkspaceHeaderProps {
  projectId: string
  projectName: string
  clientName?: string
  roomId?: string
  roomName?: string
  roomType?: string
  stageId: string
  stageType: string
  stageStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE' | string
  assignedUserName?: string | null
  dueDate?: string | Date | null
  progressPercent?: number | null
  rightSlot?: React.ReactNode
  settingsSlot?: React.ReactNode
  className?: string
}

const statusBadgeClasses: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-700',
}

export default function StageWorkspaceHeader({
  projectId,
  projectName,
  clientName,
  roomId,
  roomName,
  roomType,
  stageId,
  stageType,
  stageStatus,
  assignedUserName,
  dueDate,
  progressPercent,
  rightSlot,
  settingsSlot,
  className,
}: StageWorkspaceHeaderProps) {
  const prettyStage = getStageName(stageType)
  const roomLabel = roomName || (roomType ? roomType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : undefined)
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate || null
  const statusClass = stageStatus ? (statusBadgeClasses[stageStatus] || statusBadgeClasses.NOT_STARTED) : ''

  // Navigate back to the room's phases view
  const backUrl = roomId ? `/projects/${projectId}/rooms/${roomId}` : `/projects/${projectId}`

  return (
    <div className={cn('bg-white border-b border-gray-200 px-6 py-4', className)}>
      <div className="flex items-center justify-between">
        {/* Left: Back + Title + Meta */}
        <div className="flex items-center space-x-4">
          <Button asChild variant="ghost" size="icon" aria-label="Back to room phases">
            <Link href={backUrl}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{prettyStage} Workspace</h1>
              {stageStatus && (
                <Badge className={statusClass}>{stageStatus.replace('_', ' ')}</Badge>
              )}
              {typeof progressPercent === 'number' && (
                <span className="ml-2 text-sm text-gray-600">{Math.round(progressPercent)}% complete</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mt-1">
              {roomLabel && <span>{roomLabel}</span>}
              <span>•</span>
              <span>{projectName}</span>
              {clientName && (
                <>
                  <span>•</span>
                  <span>{clientName}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
              {assignedUserName && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> Assigned to {assignedUserName}</span>
              )}
              {due && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {due.toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Timer + custom actions + settings */}
        <div className="flex items-center gap-2">
          <WorkspaceTimerButton
            projectId={projectId}
            roomId={roomId || ''}
            stageId={stageId}
            stageType={stageType}
          />
          {rightSlot}
          {settingsSlot}
        </div>
      </div>
    </div>
  )
}
