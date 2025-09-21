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
  Plus,
  MessageSquare,
  Paperclip,
  Eye,
  Heart,
  Download,
  ExternalLink,
  Tag,
  CheckSquare,
  Layout,
  Home,
  Bookmark
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'

// Import existing components
import { ReferenceBoard } from './ReferenceBoard'
import { MessagePanel } from './MessagePanel'
import { ActionBar } from './ActionBar'

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
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DRAFT' | 'IN_REVIEW' | 'FINALIZED'
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

interface BedroomDesignWorkspaceProps {
  roomId: string
  projectId: string
  stageId: string
  className?: string
}

// Status configuration
const STATUS_CONFIG = {
  DRAFT: { name: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Clock },
  IN_REVIEW: { name: 'In Review', color: 'bg-yellow-100 text-yellow-800', icon: Eye },
  FINALIZED: { name: 'Finalized', color: 'bg-green-100 text-green-800', icon: CheckCircle2 }
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function BedroomDesignWorkspace({ 
  roomId, 
  projectId, 
  stageId,
  className = ''
}: BedroomDesignWorkspaceProps) {
  // State management
  const [currentSection, setCurrentSection] = useState<string>('overview')
  const [isCompleting, setIsCompleting] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)

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
    return completionStatus.stage.canComplete && workspaceData.stage.status !== 'FINALIZED'
  }, [workspaceData, completionStatus])

  const overallProgress = useMemo(() => {
    if (!workspaceData) return 0
    return workspaceData.completion.percentage
  }, [workspaceData])

  // Status management functions
  const updateStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/stages/${stageId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        refreshWorkspace()
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.name || newStatus}`)
      }
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  // Phase completion handler
  const handleMarkComplete = async () => {
    if (!stageId || !canMarkComplete) return

    setIsCompleting(true)
    try {
      await updateStatus('FINALIZED')
      toast.success('Design Concept finalized successfully!', {
        description: 'Ready for next phase.'
      })
    } catch (error) {
      toast.error('Failed to finalize design concept')
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
  const StatusIcon = STATUS_CONFIG[stage.status as keyof typeof STATUS_CONFIG]?.icon || Clock

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* 1. Room Overview (Top Section) */}
      <div className="px-6 py-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Home className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                {room.name || room.type} – Design Concept
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                <div className="flex items-center space-x-1">
                  <Building className="w-4 h-4" />
                  <span className="font-medium">{project.name}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span>{project.client.name}</span>
              </div>
              
              {/* Short Description */}
              <p className="text-gray-700 italic">
                "Client wants modern with warm tones."
              </p>
            </div>
          </div>

          {/* Status Controls */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">{overallProgress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
            
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={stage.status}
                onChange={(e) => updateStatus(e.target.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  STATUS_CONFIG[stage.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'
                }`}
              >
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-white/80 rounded-full h-4 border border-white">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <Palette className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Design Sections</p>
                <p className="font-bold text-gray-900">{workspaceData.completion.totalSections}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="font-bold text-gray-900">{workspaceData.completion.completedSections}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Messages</p>
                <p className="font-bold text-gray-900">
                  {stage.designSections?.reduce((total, section) => total + (section.comments?.length || 0), 0) || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-gray-600">References</p>
                <p className="font-bold text-gray-900">
                  {stage.designSections?.reduce((total, section) => total + (section.assets?.length || 0), 0) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row min-h-[600px]">
        {/* 2. Reference Board (Left/Main Section) */}
        <div className="flex-1 p-6 border-r border-gray-100">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reference Board</h2>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Layout className="w-4 h-4 mr-1" />
                  Grid View
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Reference
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Organize your design inspiration, materials, and color palettes
            </p>
          </div>

          <ReferenceBoard 
            sections={stage.designSections || []}
            onUpdate={refreshWorkspace}
            stageId={stageId}
          />
        </div>

        {/* 3. Message/Notes Panel (Right Section) */}
        <div className="w-full lg:w-96 border-l border-gray-100">
          <MessagePanel
            sections={stage.designSections || []}
            onUpdate={refreshWorkspace}
            stageId={stageId}
            projectId={projectId}
            roomId={roomId}
          />
        </div>
      </div>

      {/* 4. Action Bar (Bottom Toolbar) */}
      <ActionBar
        stageId={stageId}
        canMarkComplete={canMarkComplete}
        onMarkComplete={handleMarkComplete}
        isCompleting={isCompleting}
        onRefresh={refreshWorkspace}
        status={stage.status}
      />

      {/* Activity Timeline */}
      {showActivityLog && (
        <div className="border-t border-gray-100 p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowActivityLog(false)}
            >
              Hide Activity
            </Button>
          </div>
          {/* Activity timeline component would go here */}
          <div className="text-center py-8">
            <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Activity timeline coming soon</p>
          </div>
        </div>
      )}
    </div>
  )
}