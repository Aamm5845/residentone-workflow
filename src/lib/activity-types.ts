/**
 * Activity Types - Single source of truth for all activity types in the system
 * This file defines the vocabulary, metadata, labels, and icons for activities
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type ActivityType = 
  // Project activities
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_STATUS_CHANGED'
  | 'PROJECT_DELETED'
  // Room activities
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_STATUS_CHANGED'
  | 'ROOM_DELETED'
  // Stage activities
  | 'STAGE_STARTED'
  | 'STAGE_COMPLETED'
  | 'STAGE_REOPENED'
  | 'STAGE_ASSIGNED'
  | 'STAGE_STATUS_CHANGED'
  | 'STAGE_UPDATED'
  // Asset activities
  | 'ASSET_UPLOADED'
  | 'ASSET_DELETED'
  | 'ASSET_TAGGED'
  | 'ASSET_UNTAGGED'
  | 'ASSET_PINNED'
  | 'ASSET_UNPINNED'
  | 'ASSET_DESCRIPTION_UPDATED'
  // Comment activities
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  | 'COMMENT_TAGGED'
  | 'COMMENT_UNTAGGED'
  | 'COMMENT_PINNED'
  | 'COMMENT_UNPINNED'
  | 'COMMENT_LIKED'
  // Issue activities
  | 'ISSUE_CREATED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_ASSIGNED'
  | 'ISSUE_STATUS_CHANGED'
  | 'ISSUE_RESOLVED'
  | 'ISSUE_REOPENED'
  | 'ISSUE_COMMENT_ADDED'
  // Chat activities
  | 'CHAT_MESSAGE_SENT'
  | 'CHAT_MESSAGE_EDITED'
  | 'CHAT_MESSAGE_DELETED'
  | 'CHAT_MENTION'
  // Design activities
  | 'DESIGN_SECTION_CREATED'
  | 'DESIGN_SECTION_UPDATED'
  | 'DESIGN_SECTION_COMPLETED'
  | 'DESIGN_SECTION_DELETED'
  | 'DESIGN_TEMPLATE_CREATED'
  | 'DESIGN_TEMPLATE_UPDATED'
  | 'DESIGN_TEMPLATE_DELETED'
  | 'DESIGN_ITEM_CREATED'
  | 'DESIGN_ITEM_COMPLETED'
  | 'DESIGN_ITEM_UPDATED'
  | 'DESIGN_NOTE_CREATED'
  // Rendering activities
  | 'RENDERING_VERSION_CREATED'
  | 'RENDERING_VERSION_UPDATED'
  | 'RENDERING_VERSION_COMPLETED'
  | 'RENDERING_VERSION_DELETED'
  | 'RENDERING_PUSHED_TO_CLIENT'
  | 'RENDERING_NOTE_CREATED'
  // Drawing activities
  | 'DRAWING_UPLOADED'
  | 'DRAWING_CHECKLIST_CREATED'
  | 'DRAWING_CHECKLIST_COMPLETED'
  | 'DRAWING_STAGE_COMPLETED'
  // FFE activities
  | 'FFE_ITEM_CREATED'
  | 'FFE_ITEM_UPDATED'
  | 'FFE_STATUS_CHANGED'
  | 'FFE_ITEM_DELETED'
  // Approval activities
  | 'CLIENT_APPROVAL_SENT'
  | 'CLIENT_APPROVAL_RECEIVED'
  | 'AARON_APPROVED'
  | 'FLOORPLAN_APPROVAL_SENT'
  | 'FLOORPLAN_APPROVED'
  // Checklist activities
  | 'CHECKLIST_ITEM_CREATED'
  | 'CHECKLIST_ITEM_UPDATED'
  | 'CHECKLIST_ITEM_COMPLETED'
  | 'CHECKLIST_ITEM_REOPENED'
  | 'CHECKLIST_ITEM_DELETED'
  // Tag activities
  | 'TAG_CREATED'
  | 'TAG_DELETED'
  // Team activities
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED'
  // Session activities
  | 'SESSION_CREATED'
  | 'LOGIN'
  | 'LOGOUT'

export type ActivityCategory = 
  | 'Projects'
  | 'Rooms'
  | 'Stages'
  | 'Assets'
  | 'Comments'
  | 'Issues'
  | 'Chat'
  | 'Design'
  | 'Renderings'
  | 'Drawings'
  | 'FFE'
  | 'Approvals'
  | 'Checklists'
  | 'Tags'
  | 'Team'
  | 'System'

export interface ActivityTypeMeta {
  label: string
  icon: string
  color: string
  category: ActivityCategory
}

// ============================================================================
// Activity Type Metadata
// ============================================================================

export const ACTIVITY_TYPE_META: Record<ActivityType, ActivityTypeMeta> = {
  // Projects
  PROJECT_CREATED: {
    label: 'Project created',
    icon: 'FolderPlus',
    color: 'text-blue-600',
    category: 'Projects'
  },
  PROJECT_UPDATED: {
    label: 'Project updated',
    icon: 'Edit',
    color: 'text-blue-600',
    category: 'Projects'
  },
  PROJECT_STATUS_CHANGED: {
    label: 'Project status changed',
    icon: 'GitBranch',
    color: 'text-blue-600',
    category: 'Projects'
  },
  PROJECT_DELETED: {
    label: 'Project deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Projects'
  },

  // Rooms
  ROOM_CREATED: {
    label: 'Room created',
    icon: 'Plus',
    color: 'text-green-600',
    category: 'Rooms'
  },
  ROOM_UPDATED: {
    label: 'Room updated',
    icon: 'Edit',
    color: 'text-green-600',
    category: 'Rooms'
  },
  ROOM_STATUS_CHANGED: {
    label: 'Room status changed',
    icon: 'GitBranch',
    color: 'text-green-600',
    category: 'Rooms'
  },
  ROOM_DELETED: {
    label: 'Room deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Rooms'
  },

  // Stages
  STAGE_STARTED: {
    label: 'Stage started',
    icon: 'Play',
    color: 'text-indigo-600',
    category: 'Stages'
  },
  STAGE_COMPLETED: {
    label: 'Stage completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Stages'
  },
  STAGE_REOPENED: {
    label: 'Stage reopened',
    icon: 'RotateCcw',
    color: 'text-orange-600',
    category: 'Stages'
  },
  STAGE_ASSIGNED: {
    label: 'Stage assigned',
    icon: 'UserPlus',
    color: 'text-purple-600',
    category: 'Stages'
  },
  STAGE_STATUS_CHANGED: {
    label: 'Stage status changed',
    icon: 'GitBranch',
    color: 'text-indigo-600',
    category: 'Stages'
  },
  STAGE_UPDATED: {
    label: 'Stage updated',
    icon: 'Edit',
    color: 'text-indigo-600',
    category: 'Stages'
  },

  // Assets
  ASSET_UPLOADED: {
    label: 'Asset uploaded',
    icon: 'Upload',
    color: 'text-green-600',
    category: 'Assets'
  },
  ASSET_DELETED: {
    label: 'Asset deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Assets'
  },
  ASSET_TAGGED: {
    label: 'Asset tagged',
    icon: 'Tag',
    color: 'text-blue-600',
    category: 'Assets'
  },
  ASSET_UNTAGGED: {
    label: 'Asset untagged',
    icon: 'Tag',
    color: 'text-gray-600',
    category: 'Assets'
  },
  ASSET_PINNED: {
    label: 'Asset pinned',
    icon: 'Pin',
    color: 'text-purple-600',
    category: 'Assets'
  },
  ASSET_UNPINNED: {
    label: 'Asset unpinned',
    icon: 'Pin',
    color: 'text-gray-600',
    category: 'Assets'
  },
  ASSET_DESCRIPTION_UPDATED: {
    label: 'Asset description updated',
    icon: 'FileText',
    color: 'text-blue-600',
    category: 'Assets'
  },

  // Comments
  COMMENT_CREATED: {
    label: 'Comment added',
    icon: 'MessageSquare',
    color: 'text-blue-600',
    category: 'Comments'
  },
  COMMENT_UPDATED: {
    label: 'Comment updated',
    icon: 'Edit',
    color: 'text-blue-600',
    category: 'Comments'
  },
  COMMENT_DELETED: {
    label: 'Comment deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Comments'
  },
  COMMENT_TAGGED: {
    label: 'Comment tagged',
    icon: 'Tag',
    color: 'text-blue-600',
    category: 'Comments'
  },
  COMMENT_UNTAGGED: {
    label: 'Comment untagged',
    icon: 'Tag',
    color: 'text-gray-600',
    category: 'Comments'
  },
  COMMENT_PINNED: {
    label: 'Comment pinned',
    icon: 'Pin',
    color: 'text-purple-600',
    category: 'Comments'
  },
  COMMENT_UNPINNED: {
    label: 'Comment unpinned',
    icon: 'Pin',
    color: 'text-gray-600',
    category: 'Comments'
  },
  COMMENT_LIKED: {
    label: 'Comment liked',
    icon: 'Heart',
    color: 'text-red-600',
    category: 'Comments'
  },

  // Issues
  ISSUE_CREATED: {
    label: 'Issue created',
    icon: 'AlertCircle',
    color: 'text-red-600',
    category: 'Issues'
  },
  ISSUE_UPDATED: {
    label: 'Issue updated',
    icon: 'Edit',
    color: 'text-orange-600',
    category: 'Issues'
  },
  ISSUE_ASSIGNED: {
    label: 'Issue assigned',
    icon: 'UserPlus',
    color: 'text-purple-600',
    category: 'Issues'
  },
  ISSUE_STATUS_CHANGED: {
    label: 'Issue status changed',
    icon: 'GitBranch',
    color: 'text-orange-600',
    category: 'Issues'
  },
  ISSUE_RESOLVED: {
    label: 'Issue resolved',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Issues'
  },
  ISSUE_REOPENED: {
    label: 'Issue reopened',
    icon: 'RotateCcw',
    color: 'text-orange-600',
    category: 'Issues'
  },
  ISSUE_COMMENT_ADDED: {
    label: 'Issue comment added',
    icon: 'MessageSquare',
    color: 'text-blue-600',
    category: 'Issues'
  },

  // Chat
  CHAT_MESSAGE_SENT: {
    label: 'Message sent',
    icon: 'MessageCircle',
    color: 'text-blue-600',
    category: 'Chat'
  },
  CHAT_MESSAGE_EDITED: {
    label: 'Message edited',
    icon: 'Edit',
    color: 'text-blue-600',
    category: 'Chat'
  },
  CHAT_MESSAGE_DELETED: {
    label: 'Message deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Chat'
  },
  CHAT_MENTION: {
    label: 'Mentioned in chat',
    icon: 'AtSign',
    color: 'text-indigo-600',
    category: 'Chat'
  },

  // Design
  DESIGN_SECTION_CREATED: {
    label: 'Design section created',
    icon: 'Plus',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_SECTION_UPDATED: {
    label: 'Design section updated',
    icon: 'Edit',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_SECTION_COMPLETED: {
    label: 'Design section completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Design'
  },
  DESIGN_SECTION_DELETED: {
    label: 'Design section deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Design'
  },
  DESIGN_TEMPLATE_CREATED: {
    label: 'Design template created',
    icon: 'Layout',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_TEMPLATE_UPDATED: {
    label: 'Design template updated',
    icon: 'Edit',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_TEMPLATE_DELETED: {
    label: 'Design template deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Design'
  },
  DESIGN_ITEM_CREATED: {
    label: 'Design item created',
    icon: 'Plus',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_ITEM_COMPLETED: {
    label: 'Design item completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Design'
  },
  DESIGN_ITEM_UPDATED: {
    label: 'Design item updated',
    icon: 'Edit',
    color: 'text-pink-600',
    category: 'Design'
  },
  DESIGN_NOTE_CREATED: {
    label: 'Design note added',
    icon: 'FileText',
    color: 'text-pink-600',
    category: 'Design'
  },

  // Renderings
  RENDERING_VERSION_CREATED: {
    label: 'Rendering version created',
    icon: 'Box',
    color: 'text-indigo-600',
    category: 'Renderings'
  },
  RENDERING_VERSION_UPDATED: {
    label: 'Rendering version updated',
    icon: 'Edit',
    color: 'text-indigo-600',
    category: 'Renderings'
  },
  RENDERING_VERSION_COMPLETED: {
    label: 'Rendering version completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Renderings'
  },
  RENDERING_VERSION_DELETED: {
    label: 'Rendering version deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Renderings'
  },
  RENDERING_PUSHED_TO_CLIENT: {
    label: 'Rendering pushed to client',
    icon: 'Send',
    color: 'text-blue-600',
    category: 'Renderings'
  },
  RENDERING_NOTE_CREATED: {
    label: 'Rendering note added',
    icon: 'FileText',
    color: 'text-indigo-600',
    category: 'Renderings'
  },

  // Drawings
  DRAWING_UPLOADED: {
    label: 'Drawing uploaded',
    icon: 'FileText',
    color: 'text-orange-600',
    category: 'Drawings'
  },
  DRAWING_CHECKLIST_CREATED: {
    label: 'Drawing checklist item created',
    icon: 'CheckSquare',
    color: 'text-orange-600',
    category: 'Drawings'
  },
  DRAWING_CHECKLIST_COMPLETED: {
    label: 'Drawing checklist completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Drawings'
  },
  DRAWING_STAGE_COMPLETED: {
    label: 'Drawing stage completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Drawings'
  },

  // FFE
  FFE_ITEM_CREATED: {
    label: 'FFE item created',
    icon: 'ShoppingCart',
    color: 'text-emerald-600',
    category: 'FFE'
  },
  FFE_ITEM_UPDATED: {
    label: 'FFE item updated',
    icon: 'Edit',
    color: 'text-emerald-600',
    category: 'FFE'
  },
  FFE_STATUS_CHANGED: {
    label: 'FFE status changed',
    icon: 'GitBranch',
    color: 'text-emerald-600',
    category: 'FFE'
  },
  FFE_ITEM_DELETED: {
    label: 'FFE item deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'FFE'
  },

  // Approvals
  CLIENT_APPROVAL_SENT: {
    label: 'Sent to client for approval',
    icon: 'Send',
    color: 'text-blue-600',
    category: 'Approvals'
  },
  CLIENT_APPROVAL_RECEIVED: {
    label: 'Client approval received',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Approvals'
  },
  AARON_APPROVED: {
    label: 'Aaron approved',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Approvals'
  },
  FLOORPLAN_APPROVAL_SENT: {
    label: 'Floorplan sent for approval',
    icon: 'Send',
    color: 'text-blue-600',
    category: 'Approvals'
  },
  FLOORPLAN_APPROVED: {
    label: 'Floorplan approved',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Approvals'
  },

  // Checklists
  CHECKLIST_ITEM_CREATED: {
    label: 'Checklist item created',
    icon: 'CheckSquare',
    color: 'text-blue-600',
    category: 'Checklists'
  },
  CHECKLIST_ITEM_UPDATED: {
    label: 'Checklist item updated',
    icon: 'Edit',
    color: 'text-blue-600',
    category: 'Checklists'
  },
  CHECKLIST_ITEM_COMPLETED: {
    label: 'Checklist item completed',
    icon: 'CheckCircle2',
    color: 'text-green-600',
    category: 'Checklists'
  },
  CHECKLIST_ITEM_REOPENED: {
    label: 'Checklist item reopened',
    icon: 'RotateCcw',
    color: 'text-orange-600',
    category: 'Checklists'
  },
  CHECKLIST_ITEM_DELETED: {
    label: 'Checklist item deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Checklists'
  },

  // Tags
  TAG_CREATED: {
    label: 'Tag created',
    icon: 'Tag',
    color: 'text-blue-600',
    category: 'Tags'
  },
  TAG_DELETED: {
    label: 'Tag deleted',
    icon: 'Trash2',
    color: 'text-red-600',
    category: 'Tags'
  },

  // Team
  USER_CREATED: {
    label: 'User created',
    icon: 'UserPlus',
    color: 'text-green-600',
    category: 'Team'
  },
  USER_UPDATED: {
    label: 'User updated',
    icon: 'Edit',
    color: 'text-blue-600',
    category: 'Team'
  },
  USER_ROLE_CHANGED: {
    label: 'User role changed',
    icon: 'Shield',
    color: 'text-purple-600',
    category: 'Team'
  },
  PASSWORD_RESET_REQUESTED: {
    label: 'Password reset requested',
    icon: 'Key',
    color: 'text-orange-600',
    category: 'Team'
  },
  PASSWORD_CHANGED: {
    label: 'Password changed',
    icon: 'Key',
    color: 'text-green-600',
    category: 'Team'
  },

  // System
  SESSION_CREATED: {
    label: 'Session created',
    icon: 'LogIn',
    color: 'text-gray-600',
    category: 'System'
  },
  LOGIN: {
    label: 'Logged in',
    icon: 'LogIn',
    color: 'text-green-600',
    category: 'System'
  },
  LOGOUT: {
    label: 'Logged out',
    icon: 'LogOut',
    color: 'text-gray-600',
    category: 'System'
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getTypeMeta(type: string): ActivityTypeMeta {
  const meta = ACTIVITY_TYPE_META[type as ActivityType]
  if (!meta) {
    return {
      label: 'Activity',
      icon: 'Activity',
      color: 'text-gray-600',
      category: 'System'
    }
  }
  return meta
}

export function formatDescription(activity: {
  action: string
  entity: string
  entityId: string
  details?: any
  actor?: { name?: string | null; email?: string | null }
}): string {
  const actorName = activity.actor?.name || activity.actor?.email || 'Someone'
  const details = activity.details || {}
  const meta = getTypeMeta(activity.action)

  // Build contextual parts
  const contextParts: string[] = []

  // Add room context if available (before stage)
  if (details.roomName) {
    contextParts.push(`"${details.roomName}" room`)
  }

  // Add stage context if available
  if (details.stageName) {
    contextParts.push(`${details.stageName} stage`)
  }

  // Add project context if available (always last)
  if (details.projectName) {
    contextParts.push(`project "${details.projectName}"`)
  }

  const context = contextParts.length > 0 ? ' in ' + contextParts.join(' - ') : ''

  // Entity-specific descriptions
  switch (activity.action) {
    case 'ASSET_UPLOADED':
      const assetName = details.assetName || details.fileName || 'a file'
      return `${actorName} uploaded ${assetName}${context}`

    case 'PROJECT_CREATED':
      return `${actorName} created project "${details.projectName || 'Untitled'}"`

    case 'PROJECT_STATUS_CHANGED':
      return `${actorName} changed project status from ${details.previousStatus || 'unknown'} to ${details.newStatus || 'unknown'}`

    case 'COMMENT_CREATED':
      const preview = details.messagePreview ? `: "${details.messagePreview}"` : ''
      return `${actorName} added a comment${context}${preview}`

    case 'ISSUE_CREATED':
      return `${actorName} created issue "${details.title || 'Untitled'}"`

    case 'ISSUE_ASSIGNED':
      return `${actorName} assigned issue "${details.title || 'Untitled'}" to ${details.assigneeName || 'someone'}`

    case 'ISSUE_STATUS_CHANGED':
      return `${actorName} changed issue status from ${details.previousStatus || 'unknown'} to ${details.newStatus || 'unknown'}`

    case 'STAGE_COMPLETED':
      return `${actorName} completed ${details.stageName || activity.entity} stage${context}`

    case 'CHAT_MESSAGE_SENT':
      const messagePreview = details.messagePreview ? `: "${details.messagePreview}"` : ''
      return `${actorName} sent a message${details.channelName ? ` in ${details.channelName}` : ''}${messagePreview}`

    case 'RENDERING_VERSION_CREATED':
      return `${actorName} created rendering version ${details.version || ''}${context}`

    case 'RENDERING_PUSHED_TO_CLIENT':
      return `${actorName} pushed rendering ${details.version || ''} to client approval${context}`

    case 'FFE_ITEM_CREATED':
      return `${actorName} created FFE item "${details.itemName || 'Untitled'}"${context}`

    case 'FFE_ITEM_UPDATED':
      return `${actorName} updated FFE item "${details.itemName || 'item'}"${context}`

    case 'FFE_STATUS_CHANGED':
      const itemInfo = details.itemName ? ` "${details.itemName}"` : ''
      const statusChange = details.previousStatus && details.newStatus 
        ? ` from ${details.previousStatus} to ${details.newStatus}` 
        : ''
      return `${actorName} changed FFE item${itemInfo} status${statusChange}${context}`

    case 'PROJECT_UPDATED':
      return `${actorName} updated project "${details.projectName || 'Untitled'}"`

    case 'ROOM_CREATED':
      return `${actorName} created room "${details.roomName || 'Untitled'}"${details.projectName ? ` in project "${details.projectName}"` : ''}`

    case 'ROOM_UPDATED':
      return `${actorName} updated room "${details.roomName || 'Untitled'}"${details.projectName ? ` in project "${details.projectName}"` : ''}`

    case 'STAGE_STARTED':
      return `${actorName} started ${details.stageName || 'stage'}${context}`

    case 'STAGE_ASSIGNED':
      return `${actorName} was assigned to ${details.stageName || 'stage'}${context}`

    case 'STAGE_UPDATED':
      return `${actorName} updated ${details.stageName || 'stage'}${context}`

    case 'ASSET_DELETED':
      return `${actorName} deleted ${details.assetName || 'a file'}${context}`

    case 'CLIENT_APPROVAL_SENT':
      return `${actorName} sent ${details.version || 'version'} to client for approval${context}`

    case 'AARON_APPROVED':
      return `${actorName} approved ${details.version || 'version'} for client review${context}`

    default:
      // Generic fallback - include as much context as possible
      const action = meta.label.toLowerCase()
      let description = `${actorName} ${action}`
      
      // Add item/file name if available
      if (details.itemName) {
        description += ` "${details.itemName}"`
      } else if (details.fileName) {
        description += ` "${details.fileName}"`
      } else if (details.title) {
        description += ` "${details.title}"`
      }
      
      return description + context
  }
}

// ============================================================================
// Category Helpers
// ============================================================================

export function getActivitiesByCategory(): Record<ActivityCategory, ActivityType[]> {
  const byCategory: Record<ActivityCategory, ActivityType[]> = {
    Projects: [],
    Rooms: [],
    Stages: [],
    Assets: [],
    Comments: [],
    Issues: [],
    Chat: [],
    Design: [],
    Renderings: [],
    Drawings: [],
    FFE: [],
    Approvals: [],
    Checklists: [],
    Tags: [],
    Team: [],
    System: []
  }

  Object.entries(ACTIVITY_TYPE_META).forEach(([type, meta]) => {
    byCategory[meta.category].push(type as ActivityType)
  })

  return byCategory
}
