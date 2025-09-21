'use client'

import React from 'react'
import { 
  Clock, 
  Upload, 
  MessageSquare, 
  CheckCircle2, 
  Tag, 
  Pin, 
  FileText,
  User,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useSWR from 'swr'

interface ActivityItem {
  id: string
  action: string
  entity: string
  entityId: string
  details: Record<string, any>
  createdAt: string
  actor: {
    id: string
    name: string
    role: string
  }
}

interface ActivityTimelineProps {
  stageId: string
  limit?: number
  className?: string
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// Activity type configurations for display
const ACTIVITY_CONFIGS = {
  // Assets
  asset_uploaded: {
    icon: Upload,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'File uploaded'
  },
  asset_deleted: {
    icon: FileText,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'File deleted'
  },
  asset_tagged: {
    icon: Tag,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'File tagged'
  },
  asset_pinned: {
    icon: Pin,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'File pinned'
  },

  // Comments
  comment_created: {
    icon: MessageSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Note added'
  },
  comment_updated: {
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Note updated'
  },
  comment_deleted: {
    icon: MessageSquare,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Note deleted'
  },
  comment_pinned: {
    icon: Pin,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Note pinned'
  },

  // Sections
  section_updated: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Section updated'
  },
  section_completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Section completed'
  },

  // Checklist
  checklist_item_created: {
    icon: CheckCircle2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Checklist item added'
  },
  checklist_item_completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Checklist item completed'
  },

  // Stage
  stage_completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Stage completed'
  },

  // Default fallback
  default: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Activity'
  }
} as const

function formatActivityMessage(activity: ActivityItem): string {
  const { action, details, actor } = activity

  // Extract common details
  const sectionType = details?.sectionType
  const fileName = details?.fileName || details?.assetTitle
  const itemTitle = details?.itemTitle
  const tagName = details?.tagName
  const sectionName = getSectionDisplayName(sectionType)

  switch (action) {
    // Asset activities
    case 'asset_uploaded':
      return `${actor.name} uploaded "${fileName}" to ${sectionName}`
    
    case 'asset_deleted':
      return `${actor.name} deleted "${fileName}" from ${sectionName}`
    
    case 'asset_tagged':
      return `${actor.name} tagged "${fileName}" with "${tagName}"`
    
    case 'asset_untagged':
      return `${actor.name} removed "${tagName}" tag from "${fileName}"`
    
    case 'asset_pinned':
      return `${actor.name} pinned "${fileName}" in ${sectionName}`
    
    case 'asset_unpinned':
      return `${actor.name} unpinned "${fileName}" in ${sectionName}`

    // Comment activities
    case 'comment_created':
      return `${actor.name} added a note in ${sectionName}`
    
    case 'comment_updated':
      return `${actor.name} updated a note in ${sectionName}`
    
    case 'comment_deleted':
      return `${actor.name} deleted a note in ${sectionName}`
    
    case 'comment_pinned':
      return `${actor.name} pinned a note in ${sectionName}`
    
    case 'comment_unpinned':
      return `${actor.name} unpinned a note in ${sectionName}`

    // Section activities
    case 'section_updated':
      return `${actor.name} updated ${sectionName} section content`
    
    case 'section_completed':
      return `${actor.name} marked ${sectionName} section as complete`

    // Checklist activities
    case 'checklist_item_created':
      return `${actor.name} added "${itemTitle}" to ${sectionName} checklist`
    
    case 'checklist_item_completed':
      return `${actor.name} completed "${itemTitle}" in ${sectionName}`
    
    case 'checklist_item_deleted':
      return `${actor.name} removed "${itemTitle}" from ${sectionName}`

    // Stage activities
    case 'stage_completed':
      return `${actor.name} completed the Design Concept phase`

    default:
      return `${actor.name} performed ${action.replace(/_/g, ' ')}`
  }
}

function getSectionDisplayName(sectionType?: string): string {
  switch (sectionType) {
    case 'GENERAL': return 'General'
    case 'WALL_COVERING': return 'Wall Covering'
    case 'CEILING': return 'Ceiling'
    case 'FLOOR': return 'Floor'
    default: return 'section'
  }
}

export function ActivityTimeline({ stageId, limit = 50, className = '' }: ActivityTimelineProps) {
  const { data, error, isLoading } = useSWR<{ activities: ActivityItem[] }>(
    `/api/stages/${stageId}/activity?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true
    }
  )

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          <span className="text-gray-600">Loading activity...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800 font-medium">Failed to load activity</span>
        </div>
        <p className="text-red-700 text-sm mt-1">
          {error.message || 'There was an error loading the activity timeline.'}
        </p>
      </div>
    )
  }

  const activities = data?.activities || []

  if (activities.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">No activity yet</p>
        <p className="text-sm text-gray-500">Activity will appear here as team members work on this phase.</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <span className="text-sm text-gray-500">{activities.length} activities</span>
      </div>

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const config = ACTIVITY_CONFIGS[activity.action as keyof typeof ACTIVITY_CONFIGS] || ACTIVITY_CONFIGS.default
          const IconComponent = config.icon
          const message = formatActivityMessage(activity)
          const isLast = index === activities.length - 1

          return (
            <div key={activity.id} className="flex items-start space-x-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 ${config.bgColor} rounded-full flex items-center justify-center`}>
                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                </div>
                {!isLast && (
                  <div className="w-0.5 h-6 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Activity content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">
                      {message}
                    </p>
                    
                    {/* Additional context from details */}
                    {activity.details?.hasDescription && (
                      <p className="text-xs text-gray-500 mt-1">
                        • Included description
                      </p>
                    )}
                    
                    {activity.details?.hasMentions && (
                      <p className="text-xs text-gray-500 mt-1">
                        • Mentioned {activity.details.mentionCount} team member(s)
                      </p>
                    )}

                    {activity.details?.fileType && (
                      <p className="text-xs text-gray-500 mt-1">
                        • {activity.details.fileType.toUpperCase()} file
                        {activity.details.fileSize && 
                          ` • ${(activity.details.fileSize / 1024 / 1024).toFixed(1)} MB`
                        }
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </div>
                </div>

                {/* Actor info */}
                <div className="flex items-center space-x-2 mt-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-600" />
                  </div>
                  <span className="text-xs text-gray-600">
                    {activity.actor.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {activity.actor.role}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {activities.length >= limit && (
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing most recent {limit} activities
          </p>
        </div>
      )}
    </div>
  )
}