'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Building,
  Palette,
  Activity,
  Loader2,
  MessageCircle,
  Plus,
  Settings
} from 'lucide-react'
import { RenderIcon } from '@/lib/design-icons'
import { formatDistanceToNow } from 'date-fns'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'

import { SectionCard } from './SectionCard'
import { ActivityTimeline } from './ActivityTimeline'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from '../stages/PhaseSettingsMenu'

// Types
interface DesignSection {
  id: string
  type: 'GENERAL' | 'WALL_COVERING' | 'CEILING' | 'FLOOR'
  content?: string
  completed: boolean
  createdAt: string
  updatedAt: string
  assets: Array<{
    id: string
    title: string
    url: string
    type: string
    userDescription?: string
    createdAt: string
  }>
  comments: Array<{
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      role: string
    }
  }>
  checklistItems: Array<{
    id: string
    title: string
    description?: string
    completed: boolean
    order: number
  }>
}

interface Stage {
  id: string
  type: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE'
  assignedUser?: {
    id: string
    name: string
  }
  dueDate?: string
  startedAt?: string
  completedAt?: string
  designSections: DesignSection[]
}

interface Room {
  id: string
  type: string
  name?: string
}

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
}

interface WorkspaceData {
  stage: Stage
  room: Room
  project: Project
  completion: {
    percentage: number
    completedSections: number
    totalSections: number
  }
}

interface DesignConceptWorkspaceProps {
  roomId: string
  projectId: string
  stageId: string
  className?: string
}

// Professional section definitions
const SECTION_DEFINITIONS = [
  {
    id: 'GENERAL',
    name: 'General',
    icon: 'Sparkles',
    color: 'from-gray-600 to-gray-700',
    description: 'Overall design concept, mood, and styling direction',
    placeholder: 'Describe the overall design vision, mood, color palette, and style direction for this space...'
  },
  {
    id: 'WALL_COVERING',
    name: 'Wall Covering',
    icon: 'PaintRoller',
    color: 'from-gray-600 to-gray-700',
    description: 'Wall treatments, paint colors, wallpaper, and finishes',
    placeholder: 'Detail wall paint colors, wallpaper selections, textures, accent walls, and any special wall treatments...'
  },
  {
    id: 'CEILING',
    name: 'Ceiling',
    icon: 'PanelTop',
    color: 'from-gray-600 to-gray-700',
    description: 'Ceiling design, treatments, lighting integration, and details',
    placeholder: 'Specify ceiling treatments, crown molding, lighting fixtures, paint colors, and architectural details...'
  },
  {
    id: 'FLOOR',
    name: 'Floor',
    icon: 'Grid',
    color: 'from-gray-600 to-gray-700',
    description: 'Flooring materials, patterns, transitions, and area rugs',
    placeholder: 'Describe flooring materials, patterns, transitions between spaces, area rugs, and floor treatments...'
  }
] as const

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function DesignConceptWorkspace({ 
  roomId, 
  projectId, 
  stageId,
  className = ''
}: DesignConceptWorkspaceProps) {
  // State management
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [isCompleting, setIsCompleting] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [activeTab, setActiveTab] = useState<'sections' | 'activity'>('sections')

  // Data fetching with SWR
  const { data: workspaceData, error, isLoading, mutate: refreshWorkspace } = useSWR<WorkspaceData>(
    stageId ? `/api/stages/${stageId}/sections` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000
    }
  )

  // Completion status check
  const { data: completionStatus } = useSWR(
    stageId ? `/api/design/complete?stageId=${stageId}` : null,
    fetcher,
    {
      refreshInterval: 10000 // Check completion status more frequently
    }
  )

  // Memoized calculations
  const canMarkComplete = useMemo(() => {
    if (!workspaceData || !completionStatus) return false
    return completionStatus.stage.canComplete && workspaceData.stage.status !== 'COMPLETED'
  }, [workspaceData, completionStatus])

  const overallProgress = useMemo(() => {
    if (!workspaceData) return 0
    return workspaceData.completion.percentage
  }, [workspaceData])

  // Section management
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const expandAllSections = () => {
    setExpandedSections(new Set(SECTION_DEFINITIONS.map(s => s.id)))
  }

  const collapseAllSections = () => {
    setExpandedSections(new Set())
  }

  // Phase completion handler
  const handleMarkComplete = async () => {
    if (!stageId || !canMarkComplete) return

    setIsCompleting(true)
    try {
      const response = await fetch('/api/design/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stageId })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Design Concept phase completed successfully!', {
          description: result.nextStage?.notificationSent 
            ? `${result.nextStage.assignedUser?.name} has been notified to start 3D Rendering.`
            : 'Ready for 3D Rendering phase.'
        })

        // Refresh all related data
        await Promise.all([
          refreshWorkspace(),
          mutate(`/api/design/complete?stageId=${stageId}`),
          mutate(`/api/activity-log?stageId=${stageId}`)
        ])
      } else {
        throw new Error(result.error || 'Failed to complete phase')
      }
    } catch (error) {
      console.error('Error completing phase:', error)
      toast.error('Failed to complete phase', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsCompleting(false)
    }
  }

  // Loading states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <p className="text-gray-600">Loading Design Concept Workspace...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-800">Failed to Load Workspace</h3>
            <p className="text-red-600 mt-1">
              {error.message || 'There was an error loading the workspace. Please refresh the page.'}
            </p>
            <Button 
              onClick={() => refreshWorkspace()} 
              variant="outline" 
              size="sm"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!workspaceData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">No workspace data available.</p>
      </div>
    )
  }

  const { stage, room, project } = workspaceData

  const isNotApplicable = stage.status === 'NOT_APPLICABLE'
  
  return (
    <div className={`rounded-lg shadow-sm border ${
      isNotApplicable 
        ? 'bg-gray-100 border-gray-300 opacity-75' 
        : 'bg-white border-gray-200'
    } ${className}`}>
      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                Design Concept Workspace
              </h1>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Building className="w-4 h-4" />
                  <span className="font-medium">{room.name || room.type}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span>{project.name}</span>
                <span className="text-gray-400">•</span>
                <span>{project.client.name}</span>
              </div>

              {/* Stage Status & Assignment */}
              <div className="flex items-center space-x-4 mt-3">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    stage.status === 'COMPLETED' ? 'bg-green-500' :
                    stage.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    stage.status === 'COMPLETED' ? 'text-green-700' :
                    stage.status === 'IN_PROGRESS' ? 'text-blue-700' : 'text-gray-600'
                  }`}>
                    {stage.status === 'COMPLETED' ? 'Completed' :
                     stage.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                  </span>
                </div>

                {stage.assignedUser && (
                  <>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      <span>Assigned to {stage.assignedUser.name}</span>
                    </div>
                  </>
                )}

                {stage.dueDate && (
                  <>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Due {formatDistanceToNow(new Date(stage.dueDate), { addSuffix: true })}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress & Actions */}
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{overallProgress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
            
            {/* Phase Settings Menu */}
            <PhaseSettingsMenu 
              stageId={stage.id}
              stageName="Design Concept"
              isNotApplicable={isNotApplicable}
              onReset={() => refreshWorkspace()}
              onMarkNotApplicable={() => refreshWorkspace()}
              onMarkApplicable={() => refreshWorkspace()}
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gray-800 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex space-x-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'sections'
                ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Design Sections
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'activity'
                ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Activity Log
          </button>
          
          {/* Action buttons moved to tab bar */}
          <div className="flex-1" />
          {activeTab === 'sections' && (
            <div className="flex items-center space-x-2 px-4 py-2">
              <Button
                onClick={() => {/* TODO: Open section manager */}}
                variant="outline"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-4 h-4 mr-1" />
                Manage Sections
              </Button>
              <Button
                onClick={() => {/* TODO: Open add section dialog */}}
                variant="outline"
                size="sm"
                className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Section
              </Button>
              <Button
                onClick={expandedSections.size === 0 ? expandAllSections : collapseAllSections}
                variant="outline"
                size="sm"
              >
                {expandedSections.size === 0 ? (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Expand All
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Collapse All
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Completion Status Alert */}
        {stage.status === 'COMPLETED' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Design Concept phase completed!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Completed {formatDistanceToNow(new Date(stage.completedAt!), { addSuffix: true })}. 
                  Ready for 3D Rendering phase.
                </p>
              </div>
            </div>
          </div>
        )}

        {canMarkComplete && stage.status !== 'COMPLETED' && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    All sections ready for completion!
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Mark this phase as complete to notify the 3D Rendering team.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleMarkComplete}
                disabled={isCompleting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Phase Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content with Sidebar Layout */}
      <div className="flex">
        {/* Main Workspace */}
        <div className="flex-1 p-6">
          {/* Design Sections Tab */}
          {activeTab === 'sections' && (
            <div className="space-y-6">
              {SECTION_DEFINITIONS.map((sectionDef) => {
                const section = stage.designSections?.find(s => s.type === sectionDef.id)
                const isExpanded = expandedSections.has(sectionDef.id)

                return (
                  <SectionCard
                    key={sectionDef.id}
                    sectionDef={sectionDef}
                    section={section}
                    stageId={stageId}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleSection(sectionDef.id)}
                    onDataChange={refreshWorkspace}
                    isStageCompleted={stage.status === 'COMPLETED'}
                  />
                )
              })}
            </div>
          )}

          {/* Activity Timeline Tab */}
          {activeTab === 'activity' && (
            <div className="bg-gray-50 rounded-lg p-6">
              <ActivityTimeline stageId={stageId} />
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50">
          <PhaseChat
            stageId={stageId}
            stageName={`Design - ${room.name || room.type}`}
            className="h-full"
          />
        </div>
      </div>

      {/* Bottom Completion Button (Fixed) */}
      {canMarkComplete && stage.status !== 'COMPLETED' && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {workspaceData.completion.completedSections} of {workspaceData.completion.totalSections} sections completed
            </div>
            <Button
              onClick={handleMarkComplete}
              disabled={isCompleting}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Completing Phase...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Mark Phase Complete
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
