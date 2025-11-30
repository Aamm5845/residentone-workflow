import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

// Enhanced session interface with our custom user fields
export interface AuthSession extends Session {
  user: {
    id: string
    email?: string | null
    name?: string | null
    role: string
    orgId: string
    orgName?: string
  }
}

// Activity logging data structure
export interface ActivityLogData {
  session: AuthSession
  action: string
  entity: string
  entityId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Helper to inject attribution fields for CREATE operations
 */
export function withCreateAttribution(session: AuthSession, data: Record<string, any>) {
  return {
    ...data,
    createdById: session.user.id,
    updatedById: session.user.id,
  }
}

/**
 * Helper to inject attribution fields for UPDATE operations
 */
export function withUpdateAttribution(session: AuthSession, data: Record<string, any>) {
  return {
    ...data,
    updatedById: session.user.id,
  }
}

/**
 * Helper to inject completion attribution
 */
export function withCompletionAttribution(session: AuthSession, data: Record<string, any>) {
  return {
    ...data,
    completedById: session.user.id,
    completedAt: new Date(),
  }
}

/**
 * Extract IP address from Next.js request headers
 */
export function getIPAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (real) {
    return real.trim()
  }
  
  return undefined
}

/**
 * Extract User Agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Log activity to ActivityLog table
 */
export async function logActivity({
  session,
  action,
  entity,
  entityId,
  details,
  ipAddress,
  userAgent
}: ActivityLogData): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action,
        entity,
        entityId,
        details: details || undefined, // Store as JSON, not stringified
        ipAddress,
        orgId: session.user.orgId,
      }
    })
  } catch (error) {
    // Log the error but don't fail the main operation
    console.error('Failed to log activity:', error)
  }
}

/**
 * Batch log multiple activities
 */
export async function logActivities(activities: ActivityLogData[]): Promise<void> {
  try {
    const activityData = activities.map(({
      session,
      action,
      entity,
      entityId,
      details,
      ipAddress,
      userAgent
    }) => ({
      actorId: session.user.id,
      action,
      entity,
      entityId,
      details: details || undefined, // Store as JSON, not stringified
      ipAddress,
      orgId: session.user.orgId,
    }))

    await prisma.activityLog.createMany({
      data: activityData
    })
  } catch (error) {
    console.error('Failed to log batch activities:', error)
  }
}

/**
 * Common activity action types
 * Using SCREAMING_SNAKE_CASE for consistency
 */
export const ActivityActions = {
  // Project actions
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  PROJECT_DELETED: 'PROJECT_DELETED',

  // Room actions
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_UPDATED: 'ROOM_UPDATED',
  ROOM_STATUS_CHANGED: 'ROOM_STATUS_CHANGED',
  ROOM_DELETED: 'ROOM_DELETED',

  // Stage actions
  STAGE_STARTED: 'STAGE_STARTED',
  STAGE_COMPLETED: 'STAGE_COMPLETED',
  STAGE_REOPENED: 'STAGE_REOPENED',
  STAGE_ASSIGNED: 'STAGE_ASSIGNED',
  STAGE_STATUS_CHANGED: 'STAGE_STATUS_CHANGED',
  STAGE_UPDATED: 'STAGE_UPDATED',

  // Asset actions
  ASSET_UPLOADED: 'ASSET_UPLOADED',
  ASSET_DELETED: 'ASSET_DELETED',
  ASSET_TAGGED: 'ASSET_TAGGED',
  ASSET_UNTAGGED: 'ASSET_UNTAGGED',
  ASSET_PINNED: 'ASSET_PINNED',
  ASSET_UNPINNED: 'ASSET_UNPINNED',
  ASSET_DESCRIPTION_UPDATED: 'ASSET_DESCRIPTION_UPDATED',

  // Comment actions
  COMMENT_CREATED: 'COMMENT_CREATED',
  COMMENT_UPDATED: 'COMMENT_UPDATED',
  COMMENT_DELETED: 'COMMENT_DELETED',
  COMMENT_TAGGED: 'COMMENT_TAGGED',
  COMMENT_UNTAGGED: 'COMMENT_UNTAGGED',
  COMMENT_PINNED: 'COMMENT_PINNED',
  COMMENT_UNPINNED: 'COMMENT_UNPINNED',
  COMMENT_LIKED: 'COMMENT_LIKED',

  // Issue actions
  ISSUE_CREATED: 'ISSUE_CREATED',
  ISSUE_UPDATED: 'ISSUE_UPDATED',
  ISSUE_ASSIGNED: 'ISSUE_ASSIGNED',
  ISSUE_STATUS_CHANGED: 'ISSUE_STATUS_CHANGED',
  ISSUE_RESOLVED: 'ISSUE_RESOLVED',
  ISSUE_REOPENED: 'ISSUE_REOPENED',
  ISSUE_COMMENT_ADDED: 'ISSUE_COMMENT_ADDED',

  // Chat actions
  CHAT_MESSAGE_SENT: 'CHAT_MESSAGE_SENT',
  CHAT_MESSAGE_EDITED: 'CHAT_MESSAGE_EDITED',
  CHAT_MESSAGE_DELETED: 'CHAT_MESSAGE_DELETED',
  CHAT_MENTION: 'CHAT_MENTION',

  // Design section actions
  DESIGN_SECTION_CREATED: 'DESIGN_SECTION_CREATED',
  DESIGN_SECTION_UPDATED: 'DESIGN_SECTION_UPDATED',
  DESIGN_SECTION_COMPLETED: 'DESIGN_SECTION_COMPLETED',
  DESIGN_SECTION_DELETED: 'DESIGN_SECTION_DELETED',

  // Design template actions
  DESIGN_TEMPLATE_CREATED: 'DESIGN_TEMPLATE_CREATED',
  DESIGN_TEMPLATE_UPDATED: 'DESIGN_TEMPLATE_UPDATED',
  DESIGN_TEMPLATE_DELETED: 'DESIGN_TEMPLATE_DELETED',
  DESIGN_TEMPLATE_REORDERED: 'DESIGN_TEMPLATE_REORDERED',

  // Design item actions
  DESIGN_ITEM_CREATED: 'DESIGN_ITEM_CREATED',
  DESIGN_ITEM_COMPLETED: 'DESIGN_ITEM_COMPLETED',
  DESIGN_ITEM_UPDATED: 'DESIGN_ITEM_UPDATED',
  DESIGN_NOTE_CREATED: 'DESIGN_NOTE_CREATED',

  // Rendering actions
  RENDERING_VERSION_CREATED: 'RENDERING_VERSION_CREATED',
  RENDERING_VERSION_UPDATED: 'RENDERING_VERSION_UPDATED',
  RENDERING_VERSION_COMPLETED: 'RENDERING_VERSION_COMPLETED',
  RENDERING_VERSION_DELETED: 'RENDERING_VERSION_DELETED',
  RENDERING_PUSHED_TO_CLIENT: 'RENDERING_PUSHED_TO_CLIENT',
  RENDERING_NOTE_CREATED: 'RENDERING_NOTE_CREATED',

  // Drawing actions
  DRAWING_UPLOADED: 'DRAWING_UPLOADED',
  DRAWING_CHECKLIST_CREATED: 'DRAWING_CHECKLIST_CREATED',
  DRAWING_CHECKLIST_COMPLETED: 'DRAWING_CHECKLIST_COMPLETED',
  DRAWING_STAGE_COMPLETED: 'DRAWING_STAGE_COMPLETED',

  // FFE actions
  FFE_ITEM_CREATED: 'FFE_ITEM_CREATED',
  FFE_ITEM_UPDATED: 'FFE_ITEM_UPDATED',
  FFE_STATUS_CHANGED: 'FFE_STATUS_CHANGED',
  FFE_ITEM_DELETED: 'FFE_ITEM_DELETED',

  // Approval actions
  CLIENT_APPROVAL_SENT: 'CLIENT_APPROVAL_SENT',
  CLIENT_APPROVAL_RECEIVED: 'CLIENT_APPROVAL_RECEIVED',
  AARON_APPROVED: 'AARON_APPROVED',
  FLOORPLAN_APPROVAL_SENT: 'FLOORPLAN_APPROVAL_SENT',
  FLOORPLAN_APPROVED: 'FLOORPLAN_APPROVED',

  // Checklist actions
  CHECKLIST_ITEM_CREATED: 'CHECKLIST_ITEM_CREATED',
  CHECKLIST_ITEM_UPDATED: 'CHECKLIST_ITEM_UPDATED',
  CHECKLIST_ITEM_COMPLETED: 'CHECKLIST_ITEM_COMPLETED',
  CHECKLIST_ITEM_REOPENED: 'CHECKLIST_ITEM_REOPENED',
  CHECKLIST_ITEM_DELETED: 'CHECKLIST_ITEM_DELETED',

  // Project Update actions
  PROJECT_UPDATE_CREATED: 'PROJECT_UPDATE_CREATED',
  PROJECT_UPDATE_UPDATED: 'PROJECT_UPDATE_UPDATED',
  PROJECT_UPDATE_DELETED: 'PROJECT_UPDATE_DELETED',
  PROJECT_UPDATE_PHOTO_ADDED: 'PROJECT_UPDATE_PHOTO_ADDED',
  PROJECT_UPDATE_TASK_CREATED: 'PROJECT_UPDATE_TASK_CREATED',
  PROJECT_UPDATE_MESSAGE_ADDED: 'PROJECT_UPDATE_MESSAGE_ADDED',

  // Tag actions
  TAG_CREATED: 'TAG_CREATED',
  TAG_DELETED: 'TAG_DELETED',

  // Team management actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',

  // Session actions
  SESSION_CREATED: 'SESSION_CREATED',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Notification actions (internal)
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED',

  // Generic actions (legacy support)
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  COMPLETE: 'COMPLETE',
} as const

/**
 * Entity types for activity logging
 * Using PascalCase for consistency
 */
export const EntityTypes = {
  PROJECT: 'Project',
  ROOM: 'Room',
  STAGE: 'Stage',
  ASSET: 'Asset',
  COMMENT: 'Comment',
  ISSUE: 'Issue',
  CHAT_MESSAGE: 'ChatMessage',
  DESIGN_SECTION: 'DesignSection',
  DESIGN_TEMPLATE: 'DesignTemplate',
  DESIGN_ITEM: 'DesignItem',
  DESIGN_CONCEPT_ITEM: 'DesignConceptItem',
  DESIGN_NOTE: 'DesignNote',
  RENDERING_VERSION: 'RenderingVersion',
  RENDERING_NOTE: 'RenderingNote',
  DRAWING: 'Drawing',
  DRAWING_CHECKLIST: 'DrawingChecklist',
  FFE_ITEM: 'FFEItem',
  CLIENT_APPROVAL_VERSION: 'ClientApprovalVersion',
  FLOORPLAN_APPROVAL: 'FloorplanApproval',
  CHECKLIST_ITEM: 'ChecklistItem',
  TAG: 'Tag',
  USER: 'User',
  SESSION: 'Session',
  NOTIFICATION: 'Notification',
  PROJECT_UPDATE: 'ProjectUpdate',
  PROJECT_UPDATE_PHOTO: 'ProjectUpdatePhoto',
} as const

/**
 * Utility to validate session has required fields
 */
export function isValidAuthSession(session: any): session is AuthSession {
  return (
    session &&
    session.user &&
    typeof session.user.id === 'string' &&
    typeof session.user.orgId === 'string' &&
    typeof session.user.role === 'string'
  )
}

/**
 * Type guard for checking if user has admin privileges
 */
export function isAdminUser(session: AuthSession): boolean {
  return ['OWNER', 'ADMIN'].includes(session.user.role)
}

/**
 * Type guard for checking if user is owner
 */
export function isOwnerUser(session: AuthSession): boolean {
  return session.user.role === 'OWNER'
}
