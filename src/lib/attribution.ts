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
  ipAddress
}: ActivityLogData): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
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
      ipAddress
    }) => ({
      actorId: session.user.id,
      action,
      entity,
      entityId,
      details: details ? JSON.stringify(details) : null,
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
 */
export const ActivityActions = {
  // Project actions
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_STATUS_CHANGED: 'project_status_changed',
  PROJECT_DELETED: 'project_deleted',

  // Room actions
  ROOM_CREATED: 'room_created',
  ROOM_UPDATED: 'room_updated',
  ROOM_STATUS_CHANGED: 'room_status_changed',

  // Stage actions
  STAGE_STARTED: 'stage_started',
  STAGE_COMPLETED: 'stage_completed',
  STAGE_REOPENED: 'stage_reopened',
  STAGE_ASSIGNED: 'stage_assigned',
  STAGE_STATUS_CHANGED: 'stage_status_changed',

  // Design section actions
  SECTION_CREATED: 'section_created',
  SECTION_UPDATED: 'section_updated',
  SECTION_COMPLETED: 'section_completed',

  // Design template actions
  TEMPLATE_CREATED: 'template_created',
  TEMPLATE_UPDATED: 'template_updated',
  TEMPLATE_DELETED: 'template_deleted',
  TEMPLATE_REORDERED: 'template_reordered',

  // Asset actions
  ASSET_UPLOADED: 'asset_uploaded',
  ASSET_DELETED: 'asset_deleted',
  ASSET_TAGGED: 'asset_tagged',
  ASSET_UNTAGGED: 'asset_untagged',
  ASSET_PINNED: 'asset_pinned',
  ASSET_UNPINNED: 'asset_unpinned',

  // Comment actions
  COMMENT_CREATED: 'comment_created',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_DELETED: 'comment_deleted',
  COMMENT_TAGGED: 'comment_tagged',
  COMMENT_UNTAGGED: 'comment_untagged',
  COMMENT_PINNED: 'comment_pinned',
  COMMENT_UNPINNED: 'comment_unpinned',

  // Tag actions
  TAG_CREATED: 'tag_created',
  TAG_DELETED: 'tag_deleted',

  // Checklist actions
  CHECKLIST_ITEM_CREATED: 'checklist_item_created',
  CHECKLIST_ITEM_UPDATED: 'checklist_item_updated',
  CHECKLIST_ITEM_COMPLETED: 'checklist_item_completed',
  CHECKLIST_ITEM_REOPENED: 'checklist_item_reopened',
  CHECKLIST_ITEM_DELETED: 'checklist_item_deleted',

  // Notification actions
  NOTIFICATION_CREATED: 'notification_created',

  // Team management actions
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_ROLE_CHANGED: 'user_role_changed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PASSWORD_CHANGED: 'password_changed',

  // FFE actions
  FFE_ITEM_CREATED: 'ffe_item_created',
  FFE_ITEM_UPDATED: 'ffe_item_updated',
  FFE_STATUS_CHANGED: 'ffe_status_changed',

  // Session actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  SESSION_CREATED: 'session_created',
  SESSION_EXPIRED: 'session_expired',
} as const

/**
 * Entity types for activity logging
 */
export const EntityTypes = {
  PROJECT: 'Project',
  ROOM: 'Room',
  STAGE: 'Stage',
  DESIGN_SECTION: 'DesignSection',
  DESIGN_SECTION_TEMPLATE: 'DesignSectionTemplate',
  ASSET: 'Asset',
  COMMENT: 'Comment',
  USER: 'User',
  FFE_ITEM: 'FFEItem',
  SESSION: 'Session',
  TAG: 'Tag',
  CHECKLIST_ITEM: 'ChecklistItem',
  NOTIFICATION: 'Notification',
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
