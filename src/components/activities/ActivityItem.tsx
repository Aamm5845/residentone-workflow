'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { getTypeMeta } from '@/lib/activity-types'
import * as LucideIcons from 'lucide-react'

interface Activity {
  id: string
  action: string
  entity: string
  entityId: string
  details?: any
  createdAt: string
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string
  } | null
}

interface ActivityItemProps {
  activity: Activity
}

// Helper to get stage display name
function getStageDisplayName(stageType?: string): string {
  if (!stageType) return ''
  
  const stageNames: Record<string, string> = {
    'DESIGN_CONCEPT': 'Design Concept',
    'THREE_D': '3D Rendering',
    'CLIENT_APPROVAL': 'Client Approval',
    'DRAWINGS': 'Drawings',
    'FFE': 'FFE',
    'Design': 'Design Concept'
  }
  
  return stageNames[stageType] || stageType
}

// Helper to generate entity-specific URL - tries to get the most specific URL possible
function getEntityUrl(activity: Activity): string | null {
  const details = activity.details || {}
  const action = activity.action
  
  // If entityUrl is provided in details, use it directly
  if (details.entityUrl) {
    return details.entityUrl
  }
  
  const { projectId, roomId, stageId, stageName } = details
  
  // First, try to generate URL based on the action type (most specific)
  switch (action) {
    // Stage activities - go directly to the stage workspace
    case 'STAGE_STARTED':
    case 'STAGE_COMPLETED':
    case 'STAGE_REOPENED':
    case 'STAGE_ASSIGNED':
    case 'STAGE_STATUS_CHANGED':
    case 'STAGE_MARKED_APPLICABLE':
    case 'STAGE_MARKED_NOT_APPLICABLE':
    case 'STAGE_UPDATED':
      if (stageId) return `/stages/${stageId}`
      if (roomId && stageName) return `/rooms/${roomId}/stages/${stageName}`
      break
    
    // Design activities - go to the design concept workspace
    case 'DESIGN_SECTION_CREATED':
    case 'DESIGN_SECTION_UPDATED':
    case 'DESIGN_SECTION_COMPLETED':
    case 'DESIGN_SECTION_DELETED':
    case 'DESIGN_ITEM_CREATED':
    case 'DESIGN_ITEM_COMPLETED':
    case 'DESIGN_ITEM_UPDATED':
    case 'DESIGN_NOTE_CREATED':
      if (stageId) return `/stages/${stageId}`
      if (roomId) return `/rooms/${roomId}/stages/DESIGN_CONCEPT`
      break
    
    // Rendering activities - go to 3D rendering workspace
    case 'RENDERING_VERSION_CREATED':
    case 'RENDERING_VERSION_UPDATED':
    case 'RENDERING_VERSION_COMPLETED':
    case 'RENDERING_VERSION_DELETED':
    case 'RENDERING_PUSHED_TO_CLIENT':
    case 'RENDERING_NOTE_CREATED':
      if (stageId) return `/stages/${stageId}`
      if (roomId) return `/rooms/${roomId}/stages/THREE_D`
      break
    
    // Drawing activities - go to drawings workspace
    case 'DRAWING_UPLOADED':
    case 'DRAWING_CHECKLIST_CREATED':
    case 'DRAWING_CHECKLIST_COMPLETED':
    case 'DRAWING_STAGE_COMPLETED':
      if (stageId) return `/stages/${stageId}`
      if (roomId) return `/rooms/${roomId}/stages/DRAWINGS`
      break
    
    // FFE activities - go to FFE workspace
    case 'FFE_ITEM_CREATED':
    case 'FFE_ITEM_UPDATED':
    case 'FFE_STATUS_CHANGED':
    case 'FFE_ITEM_STATUS_CHANGED':
    case 'STATE_CHANGE':
    case 'STATUS_CHANGE':
    case 'FFE_ITEM_DELETED':
      if (roomId) return `/ffe/${roomId}/workspace`
      break
    
    // Client approval activities
    case 'CLIENT_APPROVAL_SENT':
    case 'CLIENT_APPROVAL_RECEIVED':
    case 'AARON_APPROVED':
      if (stageId) return `/stages/${stageId}`
      if (roomId) return `/rooms/${roomId}/stages/CLIENT_APPROVAL`
      break
    
    // Floorplan activities - go to project floorplan
    case 'FLOORPLAN_APPROVAL_SENT':
    case 'FLOORPLAN_APPROVED':
      if (projectId) return `/projects/${projectId}/floorplan`
      break
    
    // Project update activities
    case 'PROJECT_UPDATE_CREATED':
    case 'PROJECT_UPDATE_UPDATED':
    case 'PROJECT_UPDATE_DELETED':
    case 'PROJECT_UPDATE_PHOTO_ADDED':
    case 'PROJECT_UPDATE_TASK_CREATED':
    case 'PROJECT_UPDATE_MESSAGE_ADDED':
      if (projectId) return `/projects/${projectId}/updates`
      break
    
    // Asset/Comment activities - go to the stage
    case 'ASSET_UPLOADED':
    case 'ASSET_DELETED':
    case 'ASSET_TAGGED':
    case 'ASSET_PINNED':
    case 'COMMENT_CREATED':
    case 'COMMENT_UPDATED':
      if (stageId) return `/stages/${stageId}`
      if (roomId && stageName) return `/rooms/${roomId}/stages/${stageName}`
      break
    
    // Chat activities
    case 'CHAT_MESSAGE_SENT':
    case 'CHAT_MESSAGE_EDITED':
    case 'CHAT_MESSAGE_DELETED':
    case 'CHAT_MENTION':
      if (stageId) return `/stages/${stageId}`
      break
    
    // Issue activities
    case 'ISSUE_CREATED':
    case 'ISSUE_UPDATED':
    case 'ISSUE_ASSIGNED':
    case 'ISSUE_STATUS_CHANGED':
    case 'ISSUE_RESOLVED':
    case 'ISSUE_REOPENED':
    case 'ISSUE_COMMENT_ADDED':
      if (details.issueId) return `/issues/${details.issueId}`
      if (projectId) return `/projects/${projectId}/issues`
      break
    
    // Room activities
    case 'ROOM_CREATED':
    case 'ROOM_UPDATED':
    case 'ROOM_STATUS_CHANGED':
      if (projectId && roomId) return `/projects/${projectId}/rooms/${roomId}`
      break
    
    // Project activities
    case 'PROJECT_CREATED':
    case 'PROJECT_UPDATED':
    case 'PROJECT_STATUS_CHANGED':
      if (projectId) return `/projects/${projectId}`
      break
  }
  
  // Fallback: try entity type
  switch (activity.entity) {
    case 'Project':
      if (projectId) return `/projects/${projectId}`
      break
    case 'Room':
      if (projectId && roomId) return `/projects/${projectId}/rooms/${roomId}`
      break
    case 'Stage':
      if (stageId) return `/stages/${stageId}`
      break
    case 'FFE':
    case 'FFEItem':
      if (roomId) return `/ffe/${roomId}/workspace`
      break
    case 'Issue':
      if (details.issueId) return `/issues/${details.issueId}`
      if (projectId) return `/projects/${projectId}/issues`
      break
  }
  
  // Last resort: go to project
  if (projectId) {
    return `/projects/${projectId}`
  }
  
  return null
}

// Build a rich, informative activity description
function getActivityText(activity: Activity): {
  action: string
  itemName?: string
  extraDetails?: string
} {
  const details = activity.details || {}
  const action = activity.action
  
  // Get item name from various possible fields
  const itemName = details.itemName || details.fileName || details.assetName || details.title || details.version || null
  
  // Build action descriptions based on activity type
  switch (action) {
    // Project activities
    case 'PROJECT_CREATED':
      return { action: 'Created project' }
    case 'PROJECT_UPDATED':
      return { action: 'Updated project settings' }
    case 'PROJECT_STATUS_CHANGED':
      return { 
        action: 'Changed project status',
        extraDetails: details.previousStatus && details.newStatus 
          ? `from ${details.previousStatus} to ${details.newStatus}` 
          : undefined
      }
    case 'PROJECT_DELETED':
      return { action: 'Deleted project' }

    // Room activities
    case 'ROOM_CREATED':
      return { action: 'Created room', itemName: details.roomName }
    case 'ROOM_UPDATED':
      return { action: 'Updated room' }
    case 'ROOM_STATUS_CHANGED':
      return { action: 'Changed room status' }
    case 'ROOM_DELETED':
      return { action: 'Deleted room' }

    // Stage activities
    case 'STAGE_STARTED':
      return { action: 'Started' }
    case 'STAGE_COMPLETED':
      return { action: 'Completed' }
    case 'STAGE_REOPENED':
      return { action: 'Reopened' }
    case 'STAGE_ASSIGNED':
      return { action: 'Was assigned to' }
    case 'STAGE_STATUS_CHANGED':
    case 'STAGE_MARKED_APPLICABLE':
      return { action: 'Turned on' }
    case 'STAGE_MARKED_NOT_APPLICABLE':
      return { action: 'Turned off' }
    case 'STAGE_UPDATED':
      return { action: 'Updated' }

    // Asset activities
    case 'ASSET_UPLOADED':
      return { action: 'Uploaded', itemName }
    case 'ASSET_DELETED':
      return { action: 'Deleted', itemName }
    case 'ASSET_TAGGED':
      return { action: 'Tagged', itemName }
    case 'ASSET_PINNED':
      return { action: 'Pinned', itemName }
    case 'ASSET_UNPINNED':
      return { action: 'Unpinned', itemName }
    case 'ASSET_DESCRIPTION_UPDATED':
      return { action: 'Updated description for', itemName }

    // Comment activities
    case 'COMMENT_CREATED':
      return { 
        action: 'Added comment',
        extraDetails: details.messagePreview ? `"${details.messagePreview}"` : undefined
      }
    case 'COMMENT_UPDATED':
      return { action: 'Edited comment' }
    case 'COMMENT_DELETED':
      return { action: 'Deleted comment' }
    case 'COMMENT_PINNED':
      return { action: 'Pinned comment' }
    case 'COMMENT_LIKED':
      return { action: 'Liked a comment' }

    // Issue activities
    case 'ISSUE_CREATED':
      return { action: 'Created issue', itemName: details.title }
    case 'ISSUE_UPDATED':
      return { action: 'Updated issue', itemName: details.title }
    case 'ISSUE_ASSIGNED':
      return { 
        action: 'Assigned issue',
        itemName: details.title,
        extraDetails: details.assigneeName ? `to ${details.assigneeName}` : undefined
      }
    case 'ISSUE_STATUS_CHANGED':
      return { action: 'Changed issue status', extraDetails: details.newStatus ? `to ${details.newStatus}` : undefined }
    case 'ISSUE_RESOLVED':
      return { action: 'Resolved issue', itemName: details.title }
    case 'ISSUE_REOPENED':
      return { action: 'Reopened issue', itemName: details.title }
    case 'ISSUE_COMMENT_ADDED':
      return { action: 'Commented on issue' }

    // Chat activities
    case 'CHAT_MESSAGE_SENT':
      return { 
        action: 'Sent message',
        extraDetails: details.messagePreview ? `"${details.messagePreview}"` : undefined
      }
    case 'CHAT_MESSAGE_EDITED':
      return { action: 'Edited message' }
    case 'CHAT_MESSAGE_DELETED':
      return { action: 'Deleted message' }
    case 'CHAT_MENTION':
      return { action: 'Mentioned you' }

    // Design activities
    case 'DESIGN_SECTION_CREATED':
      return { action: 'Created design section', itemName }
    case 'DESIGN_SECTION_UPDATED':
      return { action: 'Updated design section', itemName }
    case 'DESIGN_SECTION_COMPLETED':
      return { action: 'Completed design section', itemName }
    case 'DESIGN_SECTION_DELETED':
      return { action: 'Deleted design section', itemName }
    case 'DESIGN_ITEM_CREATED':
      return { action: 'Added design item', itemName }
    case 'DESIGN_ITEM_COMPLETED':
      return { action: 'Marked complete', itemName }
    case 'DESIGN_ITEM_UPDATED':
      return { action: 'Updated design item', itemName }
    case 'DESIGN_NOTE_CREATED':
      return { action: 'Added note for', itemName: details.itemName }
    case 'DESIGN_ITEM_STATUS_CHANGED':
      return { 
        action: details.newStatus ? `Changed status to "${details.newStatus}" for` : 'Updated status of', 
        itemName 
      }

    // Rendering activities
    case 'RENDERING_VERSION_CREATED':
      return { action: 'Created new rendering version', itemName: details.version }
    case 'RENDERING_VERSION_UPDATED':
      return { action: 'Updated rendering', itemName: details.version }
    case 'RENDERING_VERSION_COMPLETED':
      return { action: 'Completed rendering', itemName: details.version }
    case 'RENDERING_VERSION_DELETED':
      return { action: 'Deleted rendering', itemName: details.version }
    case 'RENDERING_PUSHED_TO_CLIENT':
      return { action: 'Sent rendering for client approval', itemName: details.version }
    case 'RENDERING_NOTE_CREATED':
      return { action: 'Added note to rendering' }

    // Drawing activities
    case 'DRAWING_UPLOADED':
      return { action: 'Uploaded drawing', itemName }
    case 'DRAWING_CHECKLIST_CREATED':
      return { action: 'Created checklist item' }
    case 'DRAWING_CHECKLIST_COMPLETED':
      return { action: 'Completed checklist' }
    case 'DRAWING_STAGE_COMPLETED':
      return { action: 'Completed drawings phase' }

    // FFE activities
    case 'FFE_ITEM_CREATED':
      return { action: 'Added FFE item', itemName }
    case 'FFE_ITEM_UPDATED':
      return { action: 'Updated FFE item', itemName }
    case 'FFE_STATUS_CHANGED':
    case 'FFE_ITEM_STATUS_CHANGED':
    case 'STATE_CHANGE':
    case 'STATUS_CHANGE':
      // FFE activities use newState, others use newStatus
      const ffeStatus = details.newState || details.newStatus
      return { 
        action: ffeStatus ? `Changed to "${ffeStatus}"` : 'Updated status for', 
        itemName 
      }
    case 'FFE_ITEM_DELETED':
      return { action: 'Deleted FFE item', itemName }

    // Approval activities
    case 'CLIENT_APPROVAL_SENT':
      return { action: 'Sent for client approval', itemName: details.version }
    case 'CLIENT_APPROVAL_RECEIVED':
      return { action: 'Received client approval', itemName: details.version }
    case 'AARON_APPROVED':
      return { action: 'Approved for client review', itemName: details.version }
    case 'FLOORPLAN_APPROVAL_SENT':
      return { 
        action: details.isTest ? 'Sent test floorplan email' : 'Sent floorplan for approval',
        extraDetails: details.recipientEmail ? `to ${details.recipientEmail}` : undefined
      }
    case 'FLOORPLAN_APPROVED':
      return { action: 'Floorplan approved' }

    // Checklist activities
    case 'CHECKLIST_ITEM_CREATED':
      return { action: 'Created checklist item', itemName }
    case 'CHECKLIST_ITEM_UPDATED':
      return { action: 'Updated checklist item', itemName }
    case 'CHECKLIST_ITEM_COMPLETED':
      return { action: 'Completed checklist item', itemName }
    case 'CHECKLIST_ITEM_REOPENED':
      return { action: 'Reopened checklist item', itemName }
    case 'CHECKLIST_ITEM_DELETED':
      return { action: 'Deleted checklist item', itemName }

    // Project Update activities
    case 'PROJECT_UPDATE_CREATED':
      return { action: 'Posted update', itemName: details.title }
    case 'PROJECT_UPDATE_UPDATED':
      return { action: 'Edited update', itemName: details.title }
    case 'PROJECT_UPDATE_DELETED':
      return { action: 'Deleted update', itemName: details.title }
    case 'PROJECT_UPDATE_PHOTO_ADDED':
      return { action: 'Added photo to update', itemName }
    case 'PROJECT_UPDATE_TASK_CREATED':
      return { action: 'Created task from update' }
    case 'PROJECT_UPDATE_MESSAGE_ADDED':
      return { action: 'Commented on update' }

    // Tag activities
    case 'TAG_CREATED':
      return { action: 'Created tag', itemName: details.tagName }
    case 'TAG_DELETED':
      return { action: 'Deleted tag', itemName: details.tagName }

    // Team activities
    case 'USER_CREATED':
      return { action: 'Added team member', itemName: details.userName }
    case 'USER_UPDATED':
      return { action: 'Updated team member', itemName: details.userName }
    case 'USER_ROLE_CHANGED':
      return { action: 'Changed role for', itemName: details.userName }

    // Session activities
    case 'LOGIN':
      return { action: 'Logged in' }
    case 'LOGOUT':
      return { action: 'Logged out' }

    default:
      // Fallback: convert action to readable format and make it user-friendly
      let readable = action.toLowerCase().replace(/_/g, ' ')
      
      // Clean up common patterns
      readable = readable
        .replace('state change', 'updated status of')
        .replace('status change', 'updated status of')
        .replace('marked applicable', 'made phase available')
        .replace('marked not applicable', 'skipped phase')
      
      return { action: readable.charAt(0).toUpperCase() + readable.slice(1), itemName }
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const meta = getTypeMeta(activity.action)
  const details = activity.details || {}
  
  // Get the icon component dynamically
  const IconComponent = (LucideIcons as any)[meta.icon] || LucideIcons.Activity
  
  // Build the activity description
  const activityDesc = getActivityText(activity)
  
  // Extract context info
  const actorName = activity.actor?.name || activity.actor?.email?.split('@')[0] || 'Unknown'
  const projectName = details.projectName
  const roomName = details.roomName
  const stageName = details.stageName ? getStageDisplayName(details.stageName) : null
  
  // Get the entity URL
  const entityUrl = getEntityUrl(activity)
  
  // Get actor initials for avatar fallback
  const getInitials = (name: string | null | undefined, email: string | null | undefined): string => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }
  
  const initials = getInitials(activity.actor?.name, activity.actor?.email)
  
  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
  
  // Build the content wrapper - if we have a URL, make it clickable
  const ContentWrapper = entityUrl ? 
    ({ children }: { children: React.ReactNode }) => (
      <Link href={entityUrl} className="block hover:bg-slate-50 transition-colors">
        {children}
      </Link>
    ) : 
    ({ children }: { children: React.ReactNode }) => <>{children}</>
  
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <ContentWrapper>
        <div className="px-4 py-3">
          {/* Main Row */}
          <div className="flex items-start gap-3">
            {/* Actor Avatar */}
            <div className="flex-shrink-0 mt-0.5">
              {activity.actor?.image ? (
                <img
                  src={activity.actor.image}
                  alt={actorName}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs shadow-sm">
                  {initials}
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Single Line Description */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed">
                  {/* Actor Name */}
                  <span className="font-semibold text-gray-900">{actorName}</span>
                  
                  {/* Separator */}
                  <span className="text-gray-400 mx-1">—</span>
                  
                  {/* Action */}
                  <span className="text-gray-700">{activityDesc.action}</span>
                  
                  {/* Item Name (if any) */}
                  {activityDesc.itemName && (
                    <span className="font-medium text-gray-900"> "{activityDesc.itemName}"</span>
                  )}
                  
                  {/* Extra Details (if any) */}
                  {activityDesc.extraDetails && (
                    <span className="text-gray-600"> {activityDesc.extraDetails}</span>
                  )}
                  
                  {/* Room Context */}
                  {roomName && (
                    <>
                      <span className="text-gray-400"> in </span>
                      <span className="font-medium text-emerald-700">"{roomName}"</span>
                      <span className="text-gray-500"> room</span>
                    </>
                  )}
                  
                  {/* Stage Context */}
                  {stageName && (
                    <>
                      <span className="text-gray-400"> — </span>
                      <span className="font-medium text-purple-700">{stageName}</span>
                      <span className="text-gray-500"> stage</span>
                    </>
                  )}
                  
                  {/* Project Context */}
                  {projectName && (
                    <>
                      <span className="text-gray-400"> — </span>
                      <span className="text-gray-500">project </span>
                      <span className="font-medium text-blue-700">"{projectName}"</span>
                    </>
                  )}
                </p>
                
                {/* Timestamp */}
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                  {timeAgo}
                </span>
              </div>
              
              {/* Category Badge + Link */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                  meta.color.includes('green') ? 'bg-green-50 text-green-600' :
                  meta.color.includes('blue') ? 'bg-blue-50 text-blue-600' :
                  meta.color.includes('red') ? 'bg-red-50 text-red-600' :
                  meta.color.includes('orange') ? 'bg-orange-50 text-orange-600' :
                  meta.color.includes('purple') ? 'bg-purple-50 text-purple-600' :
                  meta.color.includes('pink') ? 'bg-pink-50 text-pink-600' :
                  meta.color.includes('indigo') ? 'bg-indigo-50 text-indigo-600' :
                  meta.color.includes('emerald') ? 'bg-emerald-50 text-emerald-600' :
                  meta.color.includes('cyan') ? 'bg-cyan-50 text-cyan-600' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  <IconComponent className="w-3 h-3" />
                  {meta.category}
                </span>
                
                {/* Link indicator */}
                {entityUrl && (
                  <span className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5">
                    View <LucideIcons.ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </ContentWrapper>
    </div>
  )
}
